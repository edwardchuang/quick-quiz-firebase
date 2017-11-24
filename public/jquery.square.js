/**
 * jquery.square.js
 * Simple adjusting layout library for Square Grid Layout
 * 
 * @version 0.1.0
 * @author SUSH <sush@sus-happy.net>
 * @license MIT
 */
(function($) {
    var Square = function($target, opt) {
        var self = this;

        self.set = {
            target: "square",
            inner: ".inner",
            scaleSplit: "_",
            size: 150,
            space: 10,
            speed: 700,
            duration: 500,
            ease: ""
        };
        if (opt) $.extend(self.set, opt);

        self.disabled = false;

        self.parentObj = $target.css({ position: "relative" });
        self.target = self.parentObj
            .find("*[class^=" + self.set.target + "]")
            .css({ position: "absolute" });
        self.resizeInter = null;
        self.prevWidth = self.parentObj.outerWidth();

        self.size = 0;
        self.space = 0;

        // is size is floated?
        self.isFloated =
            (isNaN(self.set.size) && self.set.size.match(/\%$/)) ||
            (isNaN(self.set.space) && self.set.space.match(/\%$/));

        self.setSize();
        self.setPosition(0);
        $(window).on("resize.square", function() {
            self.resizeStart();
        });
    };

    /**
     * Starting resize window
     */
    Square.prototype.resizeStart = function() {
        var self = this;

        // If disabled, don't dunning
        if (self.disabled) {
            return;
        }

        $(window).off("resize.square");
        self.resizeInter = setInterval(function() {
            self.resizeCheck();
        }, self.set.duration);
    };

    /**
     * Checking resize window
     */
    Square.prototype.resizeCheck = function() {
        var self = this;

        // If disabled, don't dunning
        if (self.disabled) {
            return;
        }

        self.prevWidth = self.parentObj.outerWidth();

        // if same width with previous width
        if (self.prevWidth == self.parentObj.outerWidth()) {
            clearInterval(self.resizeInter);
            $(window).on("resize.square", function() {
                self.resizeStart();
            });
            self.resizeEnd();
        }
    };

    /**
     * Ending resize window
     */
    Square.prototype.resizeEnd = function() {
        var self = this;

        // If disabled, don't dunning
        if (self.disabled) {
            return;
        }

        if (self.isFloated) {
            self.setSize();
        }
        self.setPosition(self.set.speed);
    };

    /**
     * Set each boxes size
     */
    Square.prototype.setSize = function() {
        var self = this;

        // Calc box and space size
        self.calcSize();

        self.target.each(function(i) {
            var scale = self.getScale($(this).attr("class"));
            var xsize = self.size * scale.x + self.space * (scale.x - 1);
            var ysize = self.size * scale.y + self.space * (scale.y - 1);

            $(this).css({ width: xsize, height: ysize });
            if ($(this).find(self.set.inner).length > 0) {
                var inner = $(this).find(self.set.inner);
                inner.height(ysize);

                if (inner.outerHeight() > ysize) {
                    var height = inner.height() - (inner.outerHeight() - ysize);
                    inner.height(height);
                }
            }
        });
    };

    /**
     * Set position each boxes
     */
    Square.prototype.setPosition = function(sp) {
        var self = this;

        var matrix = [];
        var mpos = {};
        var tHeight = 0;

        self.target.each(function(i) {
            mpos = self.blankMatrix(matrix);

            var scale = self.getScale($(this).attr("class"));
            var sizex = self.size * scale.x + self.space * (scale.x - 1);
            var sizey = self.size * scale.y + self.space * (scale.y - 1);
            var flag = true;

            if (self.checkSize(mpos.x, scale)) {
                mpos.x = 0;
                mpos.y++;
            }
            while (self.matrixCheck(matrix, mpos.x, mpos.y, scale)) {
                mpos.x++;
                if (self.checkSize(mpos.x, scale)) {
                    mpos.x = 0;
                    mpos.y++;
                }
            }

            for (var x = 0; x < scale.x; x++) {
                for (var y = 0; y < scale.y; y++) {
                    if (!matrix[mpos.x + x]) matrix[mpos.x + x] = [];
                    matrix[mpos.x + x][mpos.y + y] = true;
                }
            }

            var pos = {
                x: self.space + self.size * mpos.x + self.space * mpos.x,
                y: self.space + self.size * mpos.y + self.space * mpos.y
            };
            if (sp > 0) {
                self.goTween($(this), { left: pos.x, top: pos.y }, sp);
            } else {
                $(this).css({ left: pos.x, top: pos.y });
            }

            tHeight =
                pos.y + sizey + self.space > tHeight
                    ? pos.y + sizey + self.space
                    : tHeight;
        });
        if (sp > 0) {
            self.goTween(self.parentObj, { height: tHeight }, sp);
        } else {
            self.parentObj.css({ height: tHeight });
        }
    };

    /**
     * Get box scale
     */
    Square.prototype.getScale = function(clsName) {
        var self = this;

        var tmp = clsName.split(" ");
        for (i in tmp) {
            if (tmp[i].match(self.set.scaleSplit)) {
                var xNum = tmp[i].split(self.set.scaleSplit)[1];
                var yNum = tmp[i].split(self.set.scaleSplit)[2];
                if (xNum) {
                    if (yNum) return { x: xNum, y: yNum };
                    else return { x: xNum, y: xNum };
                }
            }
        }
        return { x: 1, y: 1 };
    };

    /**
     * Check avaivable matrix position
     */
    Square.prototype.matrixCheck = function(matrix, x, y, scale) {
        var self = this;

        if (!matrix) {
            return false;
        }
        for (var i = 0; i < scale.x; i++) {
            for (var j = 0; j < scale.y; j++) {
                if (!matrix[x + i]) {
                    continue;
                } else if (!matrix[x + i][y + j]) {
                    continue;
                }
                return matrix[x + i][y + j];
            }
        }
        return false;
    };

    /**
     * Search blank position of matrix
     */
    Square.prototype.blankMatrix = function(matrix) {
        var self = this;

        var pos = { x: 0, y: 0 };
        while (self.matrixCheck(matrix, pos.x, pos.y, 1)) {
            pos.x++;
            if (self.checkSize(pos.x, 1)) {
                pos.x = 0;
                pos.y++;
            }
        }
        return pos;
    };

    /**
     * Check size
     */
    Square.prototype.checkSize = function(x, scale) {
        var self = this;

        var size = self.size * scale.x + self.space * (scale.x - 1);
        var tsize = self.size * x + self.space * (x + 2) + size;
        return tsize > self.parentObj.outerWidth();
    };

    /**
     * Running animation of target object
     */
    Square.prototype.goTween = function(jObj, prop, sp) {
        var self = this;

        if (self.set.ease && $.easing[self.set.ease]) {
            jObj.stop(true, false).animate(prop, sp, self.set.ease);
        } else {
            jObj.stop(true, false).animate(prop, sp);
        }
    };

    /**
     * Calculate size
     */
    Square.prototype.calcSize = function() {
        var self = this;

        // Space
        if (!isNaN(self.set.space)) {
            self.space = self.set.space;
        } else if (self.set.space.match(/\%$/)) {
            var per = self.set.space.replace("%", "") - 0;
            self.space = self.parentObj.width() * (per / 100);
        }

        // Size
        if (!isNaN(self.set.size)) {
            self.size = self.set.size;
        } else if (self.set.size.match(/\%$/)) {
            var per = self.set.size.replace("%", "") - 0;
            var spaces = Math.ceil(100 / per);

            self.size =
                (self.parentObj.width() - self.space * (spaces + 1)) *
                (per / 100);
        }
    };

    /**
     * Destroy
     */
    Square.prototype.destroy = function() {
        var self = this;
        self.disabled = true;

        if (self.resizeInter) {
            clearInterval(self.resizeInter);
        }
        $(window).off(".square");
        self.parentObj.attr("style", "");
        self.target.attr("style", "");
    };

    $.fn.square = function(opt) {
        return new Square($(this), opt);
    };
})(jQuery);
