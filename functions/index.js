const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const express = require('express');
const cookieParser = require('cookie-parser')();
const cors = require('cors')({origin: true});
const app = express();

// Express middleware that validates Firebase ID Tokens passed in the Authorization HTTP header.
// The Firebase ID token needs to be passed as a Bearer token in the Authorization HTTP header like this:
// `Authorization: Bearer <Firebase ID Token>`.
// when decoded successfully, the ID Token content will be added as `req.user`.
const validateFirebaseIdToken = (req, res, next) => {
  console.log('Check if request is authorized with Firebase ID token');

  if ((!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) &&
      !req.cookies.__session) {
    console.error('No Firebase ID token was passed as a Bearer token in the Authorization header.',
        'Make sure you authorize your request by providing the following HTTP header:',
        'Authorization: Bearer <Firebase ID Token>',
        'or by passing a "__session" cookie.');
    res.status(403).send('Unauthorized');
    return;
  }

  let idToken;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    console.log('Found "Authorization" header');
    // Read the ID Token from the Authorization header.
    idToken = req.headers.authorization.split('Bearer ')[1];
  } else {
    console.log('Found "__session" cookie');
    // Read the ID Token from cookie.
    idToken = req.cookies.__session;
  }
  admin.auth().verifyIdToken(idToken).then(decodedIdToken => {
    console.log('ID Token correctly decoded', decodedIdToken);
    req.user = decodedIdToken;
    next();
  }).catch(error => {
    console.error('Error while verifying Firebase ID token:', error);
    res.status(403).send('Unauthorized');
  });
};

app.use(cors);
app.use(cookieParser);
app.use(validateFirebaseIdToken);
app.post('/answer', (req, res) => {
    var db = admin.firestore();
    
    // step 1 get session info (and check if still in game)
    function getSession() {
        return new Promise((resolve, reject) => {
            return admin.database().ref('/session').once('value').then((snapshot) => {
                resolve(snapshot.val());
            }).catch((error) => {
                console.log('error', error);
                reject('Game get error: ' + JSON.stringify(error));
            });
        });
    }

    // step 2 get result
    function getResult() {
        return new Promise((resolve, reject) => {
            return admin.database().ref('/result').once('value').then((snapshot) => {
                resolve(snapshot.val());
            }).catch((error) => {
                console.log('error', error);
                reject('Game get error: ' + JSON.stringify(error));
            });
        });
    }

    // step 3 get gaming data
    function getGameData(quiz_id) {
        return new Promise((resolve, reject) => {
            var quiz = db.collection("quiz").doc(quiz_id);
            quiz.get().then(function(doc) {
                resolve(doc);
            }).catch(function(error) {
                console.log("Error getting documents: ", error);
                reject("Error getting documents: " + JSON.stringify(error));
            });
        });
    }

    // step 4 write the winner
    function setSessionWinner(quiz_id, winner_name, winner_id, answer) {
        return new Promise((resolve, reject) => {
            var data = {
                'quiz_id': quiz_id,
                'winner_name': winner_name,
                'winner': winner_id,
                'answer_time': '' + new Date(),
                'answer': answer
            };

            return admin.database().ref('/result').set(data).then(() => {
                resolve();
            }).catch((error) => {
                console.log('error', error);
                reject('Firebase update error: ' + JSON.stringify(error));
            });
        });
    }

    // step 5 remove session info
    function removeSession() {
        return new Promise((resolve, reject) => {
            return admin.database().ref('/session').update({'has_winner': true}).then(() => {
                resolve();
            }).catch((error) => {
                console.log('error', error);
                reject('Game get error: ' + JSON.stringify(error));
            });
        });
    }

    //reject if no quiz_id
    if (undefined === req.body.quiz_id || "" == req.body.quiz_id) {
        res.status(403).send({'error': 1, 'message': 'wrong parameter(s)'});
        return;
    }

    // reject if no answer
    if (undefined === req.body.answer || "" == req.body.answer) {
        res.status(403).send({'error': 2, 'message': 'wrong parameter(s)'});
        return;
    }

    var step1 = getSession();
    var step2 = getResult();
    var step3 = getGameData(req.body.quiz_id);

    return Promise.all([step1, step2, step3]).then(function([session, result, gameData]) {
        
        // check if same session
        if (null == session || session.quiz_id != req.body.quiz_id) {
            res.status(403).send({'error': 3, 'message': 'the party is over'});
            return;
        }

        // check if there's already a winner
        if (undefined !== result && null != result && result.quiz_id == req.body.quiz_id) {
            res.status(403).send({'error': 4, 'message': 'the party is over'});
            return;
        }

        // check if right answer
        if (undefined === gameData || !gameData.exists || req.body.answer != gameData.data().answer) {
            res.status(200).send({'error': 5, 'message': 'wrong answer!!', 'your': req.body.answer, 'mime': gameData.data().answer});
            return;
        }

        // get the answer text
        var answerText = "";
        for (var i = 0 ; i < gameData.data().options.length ; i++ ) {
            if (gameData.data().options[i].id == req.body.answer) {
                answerText = gameData.data().options[i].text;
                break;
            }
        }

        var step4 = setSessionWinner(session.quiz_id, req.user.name, req.user.user_id, answerText);
        var step5 = removeSession();

        return Promise.all([step4, step5]).then(() => {
            res.send({'error': 0, 'message': 'OK'});
        }).catch((error) => {
            console.log('error', error);
            res.status(403).send({'error': 6, 'message': error});
        });
    }).catch((error) => {
        console.log('error', error);
        res.status(403).send({'error': 7, 'message': error});
    });

});

app.get('/newgame', (req, res) => {
    // step 1 get least played game in Firestore
    var db = admin.firestore();
    function getGame() {
        return new Promise((resolve, reject) => {
            var quiz = db.collection("quiz").orderBy('played', 'asc').limit(1);
            quiz.get().then(function(querySnapshot) {
                querySnapshot.forEach(function(doc) {
                    resolve(doc); // we're limited to 1 so ..
                });
            }).catch(function(error) {
                console.log("Error getting documents: ", error);
                reject("Error getting documents: " + JSON.stringify(error));
            });
        });
    }
    
    // step 2 save to database 
    function saveToSession(quiz) {
        return new Promise((resolve, reject) => {
            const options = quiz.data().options.reduce((m, o) => {
                m[o.id] = o.text;
                return m;
            }, {});

            var data = {
                'quiz_id': quiz.id,
                'expired': new Date(new Date().getTime() + 60000), // session expired in 60 seconds
                'options': options,
                'title': quiz.data().question,
                'has_winner': false
            };

            return admin.database().ref('/session').update(data).then(() => {
                resolve(quiz.id);
            }).catch((error) => {
                console.log('error', error);
                reject('Firebase update error: ' + JSON.stringify(error));
            });
        });
    }

    // step 3 update played counter
    function updatePlayedCount(quiz_id) {
        return new Promise((resolve, reject) => {
            var quiz = db.collection("quiz").doc(quiz_id);

            return db.runTransaction(t => { // use transaction to implement a counter++ effect
                return t.get(quiz).then(doc => {
                    const new_count = doc.data().played + 1;
                    t.update(quiz, { played: new_count });
                    resolve();
                });
            });
        });
    }

    var adminList = ['BTKOBzpjdsfLMyzx0xuGTdkMLa52'];
    if (-1 == adminList.indexOf(req.user.user_id)) {
        res.status(403).send('permission denied, admin only');
    }

    getGame().then(function(doc) {
        saveToSession(doc).then((id, played) => {
            updatePlayedCount(id).then(() => {
                res.send('New game assigned: ' + id);
            }).catch((error) => {
                res.status(403).send(error);
            })
        }).catch((error) => {
            res.status(403).send(error);
        })
    }).catch((error) => {
        res.status(403).send(error);
    })
});

// This HTTPS endpoint can only be accessed by your Firebase Users.
// Requests need to be authorized by providing an `Authorization` HTTP header
// with value `Bearer <Firebase ID Token>`.
exports.app = functions.https.onRequest(app);