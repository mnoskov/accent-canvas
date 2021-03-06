var Accent = function(canvas, options) {
    options = options || {};

    var type = canvas.tagName.toLowerCase();

    if (type == 'img') {
        this.image = canvas;
        this.image.style.display = 'none';

        this.container = document.createElement('div');
        this.image.parentNode.insertBefore(this.container, this.image);
        this.container.appendChild(this.image);

        this.canvas = document.createElement('canvas');
        this.container.appendChild(this.canvas);
    } else {
        if (!options.image) {
            console.error('Image option not specified!');
            return null;
        }

        this.image = document.createElement('img');
        this.image.src = options.image;

        if (type == 'canvas') {
            this.canvas = canvas;
            this.container = document.createElement('div');
            this.canvas.parentNode.insertBefore(this.container, this.canvas);
            this.container.appendChild(this.canvas);
        } else if (type == 'div') {
            this.container = canvas;
            this.canvas = document.createElement('canvas');
            this.container.appendChild(this.canvas);
        } else {
            console.error('Unsupported node!');
            return null;
        }
    }

    this.options = {
        enableZoom: true,
        startZoom: false, // or digit, 'contain', 'cover'
        zoomSteps:  [0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10],
        zoomSpeed: 100,
        style: {
            fill: '#000',
            fillOpacity: 0,
            stroke: 'none',
            strokeWidth: 0,
            strokeOpacity: 0
        },
        hoverSpeed: 150
    };

    this.animations = [];

    this.setOptions(options);

    this.setOptions({
        hoverStyle: Object.assign({}, this.options.style, options.hoverStyle || {
            fillOpacity: Math.min(1, this.options.style.fillOpacity + 0.3),
            strokeOpacity: Math.min(1, this.options.style.strokeOpacity + 0.3)
        })
    });

    this.initialize();
};

Accent.prototype = {
    initialize: function() {
        var self = this;

        if (!this.image.width || !this.image.height) {
            var temp = new Image();

            temp.onload = function() {
                self.initialize();
                temp.remove();
            };

            temp.src = this.image.src;
            return;
        }

        this.context = this.canvas.getContext('2d');
        this.canvas.width  = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;

        this.dragStart = {x: 0, y: 0};

        // size limits of the virtual canvas
        this.vxMax = this.canvas.width;
        this.vyMax = this.canvas.height;

        if (this.options.startZoom == 'cover') {
            this.zoom = this.options.zoomSteps[this.options.zoomSteps.length - 1];

            for (var i = this.options.zoomSteps.length - 1; i >= 0; i--) {
                var zoom = this.options.zoomSteps[i];

                if (this.image.width * zoom >= this.canvas.width && this.image.height * zoom >= this.canvas.height) {
                    this.zoom = zoom;
                } else {
                    break;
                }
            }
        } else if (this.options.startZoom == 'contain' || this.options.startZoom === false) {
            this.zoom = this.options.zoomSteps[0];

            for (var i = 0; i < this.options.zoomSteps.length; i++) {
                var zoom = this.options.zoomSteps[i];

                if (this.image.width * zoom <= this.canvas.width && this.image.height * zoom <= this.canvas.height) {
                    this.zoom = zoom;
                } else {
                    break;
                }
            }
        } else {
            this.zoom = this.options.startZoom;
        }

        this.offset = {
            x: (this.canvas.width * this.zoom - this.canvas.width) / this.zoom * 0.5,
            y: (this.canvas.height * this.zoom - this.canvas.height) / this.zoom * 0.5
        };

        if (this.options.areas) {
            for (var i = 0; i < this.options.areas.length; i++) {
                var area = this.options.areas[i];

                area.bounds = [{
                    x: area.coords[0],
                    y: area.coords[1]
                }, {
                    x: area.coords[0],
                    y: area.coords[1]
                }];

                for (var j = 0; j < area.coords.length; j += 2) {
                    var x = area.coords[j],
                        y = area.coords[j + 1];

                    area.bounds[0].x = Math.min(area.bounds[0].x, area.coords[j]);
                    area.bounds[0].y = Math.min(area.bounds[0].y, area.coords[j + 1]);
                    area.bounds[1].x = Math.max(area.bounds[1].x, area.coords[j]);
                    area.bounds[1].y = Math.max(area.bounds[1].y, area.coords[j + 1]);
                }

                if (area.style) {
                    area.hoverStyle = Object.assign({}, area.style, area.hoverStyle || {
                        fillOpacity: Math.min(1, area.style.fillOpacity + 0.3),
                        strokeOpacity: Math.min(1, area.style.strokeOpacity + 0.3)
                    });
                }
            }
        }

        this.canvas.addEventListener('mouseup', function(event) {
            self.mouseup(event);
        });

        this.canvas.addEventListener('mousedown', function(event) {
            self.mousedown(event);
        });

        this.canvas.addEventListener('mousemove', function(event) {
            self.mousemove(event);
        });

        this.canvas.addEventListener('touchstart', function(event) {
            self.mousedown(event);
        });

        this.canvas.addEventListener('touchend', function(event) {
            self.mouseup(event);
        });

        this.canvas.addEventListener('touchcancel', function(event) {
            self.mouseup(event);
        });

        this.canvas.addEventListener('touchmove', function(event) {
            self.mousemove(event);
        });

        window.addEventListener('resize', function(event) {
            self.resize(event);
        });

        if (this.options.enableZoom) {
            this.canvas.addEventListener('mousewheel', function(event) {
                self.mousewheel(event);
            });
        }

        this.recalculatePoints();
        this.draw();
    },

    setOptions: function(options) {
        options = options || {};

        for (var key in options) {
            if (options.hasOwnProperty(key)) {
                this.options[key] = options[key];
            }
        }
    },

    isPointInBounds: function(point, bounds) {
        return point.x >= bounds[0].x && point.y >= bounds[0].y && point.x <= bounds[1].x && point.y <= bounds[1].y;
    },

    isPointInShape: function(point, shape) {
        var isIn = false,
            length = shape.length / 2;

        for (var i = 0; i < length; i++) {
            var next = (i * 2 + 2) % shape.length;

            var startX = shape[i * 2];
            var startY = shape[i * 2 + 1];
            var endX   = shape[next];
            var endY   = shape[next + 1];

            if (((startY >= point.y && endY < point.y) || (startY < point.y && endY >= point.y)) && (point.x < (endX - startX) * (point.y - startY) / (endY - startY) + startX)) {
                isIn = !isIn;
            }
        }

        return isIn;
    },

    isPointInArea: function(point, area) {
        if (!this.isPointInBounds(point, area.virtBounds)) {
            return false;
        }

        if (!this.isPointInShape(point, area.virtCoords)) {
            return false;
        }

        return true;
    },

    recalculatePoints: function() {
        var centerX = this.vxMax * 0.5,
            centerY = this.vyMax * 0.5,
            imagePoint = {
                x: centerX - this.image.width * 0.5,
                y: centerY - this.image.height * 0.5
            },
            imageVirtPoint = this.vmapr(imagePoint.x, imagePoint.y);

        if (this.options.areas) {
            for (var i = 0; i < this.options.areas.length; i++) {
                var area = this.options.areas[i];

                area.virtBounds = [
                    this.vmapr(imagePoint.x + area.bounds[0].x, imagePoint.y + area.bounds[0].y),
                    this.vmapr(imagePoint.x + area.bounds[1].x, imagePoint.y + area.bounds[1].y),
                ];

                area.virtCenter = {
                    x: area.virtBounds[0].x + (area.virtBounds[1].x - area.virtBounds[0].x) * 0.5,
                    y: area.virtBounds[0].y + (area.virtBounds[1].y - area.virtBounds[0].y) * 0.5
                };

                area.virtCoords = [];

                for (var j = 0; j < area.coords.length; j += 2) {
                    var point = this.vmapr(imagePoint.x + area.coords[j], imagePoint.y + area.coords[j + 1]);
                    area.virtCoords.push(point.x, point.y);
                }
            }
        }

        this.image.virtualOffset = {
            x: imageVirtPoint.x,
            y: imageVirtPoint.y
        };
        this.image.virtualWidth  = this.image.width * this.zoom;
        this.image.virtualHeight = this.image.height * this.zoom;
    },

    findAreaUnderCursor: function(point) {
        var areaFound = false,
            event;

        for (var i = 0; i < this.options.areas.length; i++) {
            var area = this.options.areas[i];

            if (!areaFound && this.isPointInArea(point, area)) {
                areaFound = area;

                if (!area.active) {
                    event = new CustomEvent('areamousein', {
                        bubbles: true,
                        detail: {
                            area: area
                        }
                    });

                    this.canvas.dispatchEvent(event);
                    this.startFadeAnimation(area, true);
                    area.active = true;
                }
            } else {
                if (area.active) {
                    event = new CustomEvent('areamouseout', {
                        bubbles: true,
                        detail: {
                            area: area
                        }
                    });

                    this.canvas.dispatchEvent(event);
                    this.startFadeAnimation(area, false);
                    area.active = false;
                }
            }
        }

        return areaFound;
    },

    getPointFromEvent: function(e, average) {
        if (e.touches) {
            let touches = e.targetTouches.length ? e.targetTouches : e.changedTouches;
            let rect = e.target.getBoundingClientRect();

            let result = {
                x: 0,
                y: 0
            };

            if (average === true) {
                for (let i = 0; i < touches.length; i++) {
                    result.x += touches[i].clientX;
                    result.y += touches[i].clientY;
                }

                result = {
                    x: result.x / touches.length - rect.x - window.scrollX,
                    y: result.y / touches.length - rect.y - window.scrollY
                };
            } else {
                result = {
                    x: touches[0].clientX - rect.x - window.scrollX,
                    y: touches[0].clientY - rect.y - window.scrollY
                };
            }

            return result;
        }

        return {
            x: e.offsetX,
            y: e.offsetY
        };
    },

    mousedown: function(e) {
        e.preventDefault();

        this.dragStart = this.getPointFromEvent(e);
        this.isMoved = false;
        this.isScaling = false;

        if (e.targetTouches) {
            var touches = e.targetTouches;

            if (touches.length >= 2) {
                this.touchesDistance = this.distance(touches[0], touches[1]);
                this.scalingZoomStart = this.zoom;
                this.isScaling = true;
            }
        }
    },

    mouseup: function(e) {
        if (this.isMoved) {
            return;
        }

        if (this.options.areas) {
            var point = this.getPointFromEvent(e);
            var area = this.findAreaUnderCursor(point);

            if (area) {
                var event = new CustomEvent('areaclick', {
                    bubbles: true,
                    detail: {
                        area: area
                    }
                });

                this.canvas.dispatchEvent(event);
            }
        }
    },

    distance: function(p1, p2) {
        return (Math.sqrt(Math.pow((p1.clientX - p2.clientX), 2) + Math.pow((p1.clientY - p2.clientY), 2)));
    },

    mousemove: function(e) {
        let point = this.getPointFromEvent(e);
        let mousePos = this.rmapv(point.x, point.y);

        if (e.buttons || e.touches) {
            if (this.dragStart == null) {
                this.dragStart = point;
            }

            if (e.touches) {
                if (Math.abs(this.dragStart.x - point.x) > 5 || Math.abs(this.dragStart.y - point.y) > 5) {
                    this.isMoved = true;
                }
            } else {
                this.isMoved = true;
            }

            if (this.isMoved) {
                let startPos = this.rmapv(this.dragStart.x, this.dragStart.y);

                if (e.targetTouches) {
                    let touches = e.targetTouches;

                    if (this.isScaling && touches.length >= 2) {
                        let zoom = this.scalingZoomStart * this.distance(touches[0], touches[1]) / this.touchesDistance;
                        let avgPoint = this.getPointFromEvent(e, true);
                        this.setZoom(zoom, avgPoint.x, avgPoint.y, false);
                    }
                }

                // Adjust offset
                this.offset.x += startPos.x - mousePos.x;
                this.offset.y += startPos.y - mousePos.y;

                this.dragStart.x = point.x;
                this.dragStart.y = point.y;

                this.recalculatePoints();
                this.draw();
            }
        }

        if (this.options.areas) {
            this.findAreaUnderCursor(point);
        }
    },

    mousewheel: function(e) {
        e.preventDefault();

        let step  = this.getZoomStep(this.zoom);
            delta = e.deltaY || e.detail || e.wheelDelta;

        if (this.canvas.animation && this.zoomTo) {
            step = this.options.zoomSteps.indexOf(this.zoomTo);
        }

        step += delta < 0 ? 1 : -1;
        step = Math.max(0, Math.min(step, this.options.zoomSteps.length - 1));

        this.setZoom(this.options.zoomSteps[step], e.offsetX, e.offsetY);
    },

    getZoomStep: function(zoom) {
        let step = this.options.zoomSteps.indexOf(zoom);

        if (step === -1) {
            let distance = null;

            for (let i = 0; i < this.options.zoomSteps.length; i++) {
                let stepDistance = Math.abs(this.options.zoomSteps[i] - this.zoom);

                if (distance === null || distance > stepDistance) {
                    distance = stepDistance;
                    step = i;
                }
            }
        }

        return step;
    },

    zoomIn: function() {
        let step = this.getZoomStep(this.zoom);

        if (this.canvas.animation && this.zoomTo) {
            step = this.options.zoomSteps.indexOf(this.zoomTo);
        }

        step = Math.max(0, Math.min(step + 1, this.options.zoomSteps.length - 1));

        this.setZoom(this.options.zoomSteps[step]);
    },

    zoomOut: function() {
        let step = this.getZoomStep(this.zoom);

        if (this.canvas.animation && this.zoomTo) {
            step = this.options.zoomSteps.indexOf(this.zoomTo);
        }

        step = Math.max(0, Math.min(step - 1, this.options.zoomSteps.length - 1));

        this.setZoom(this.options.zoomSteps[step]);
    },

    setZoom: function(zoom, x, y, animate) {
        if (typeof x == 'undefined' || x === null) {
            x = this.canvas.width * 0.5;
        }
        if (typeof y == 'undefined' || y === null) {
            y = this.canvas.height * 0.5;
        }

        var vPoint = this.rmapv(x, y);

        this.zoomTo = zoom;

        if (animate === false) {
            var rx = (vPoint.x - this.offset.x) / this.vwidth();
            var ry = (vPoint.y - this.offset.y) / this.vheight();

            this.zoom = this.zoomTo;

            this.offset.x = vPoint.x - rx * this.vwidth();
            this.offset.y = vPoint.y - ry * this.vheight();

            this.recalculatePoints();
            this.draw();
        } else {
            if (this.canvas.animation) {
                this.canvas.animation.start    = performance.now();
                this.canvas.animation.zoomFrom = this.zoom;
                this.canvas.animation.zoomTo   = this.zoomTo;
            } else {
                (function(self, vPoint) {
                    var animation = {
                        target: self.canvas,
                        start: performance.now(),
                        duration: self.options.zoomSpeed,
                        zoomFrom: self.zoom,
                        zoomTo: self.zoomTo,
                        draw: function(progress, animation) {
                            var rx = (vPoint.x - self.offset.x) / self.vwidth();
                            var ry = (vPoint.y - self.offset.y) / self.vheight();

                            self.zoom = animation.zoomFrom + progress * (animation.zoomTo - animation.zoomFrom);

                            self.offset.x = vPoint.x - rx * self.vwidth();
                            self.offset.y = vPoint.y - ry * self.vheight();

                            self.recalculatePoints();
                            self.draw();
                        },
                        end: function() {
                            var event = new CustomEvent('zoomchanged', {
                                bubbles: true,
                                detail: {
                                    zoom: self.zoom
                                }
                            });

                            self.canvas.dispatchEvent(event);
                        }
                    };

                    self.canvas.animation = animation;
                    self.animations.push(animation);
                    self.animate();
                })(this, vPoint);
            }
        }
    },

    resize: function(event) {
        this.canvas.width  = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;

        this.vxMax = this.canvas.width;
        this.vyMax = this.canvas.height;

        this.recalculatePoints();
        this.draw();
    },

    makeProgressColor: function(start, end, progress)
    {
        var result;

        if (start.r == end.r && start.g == end.g && start.b == end.b || !progress) {
            result = start;
        } else if (progress == 1) {
            result = end;
        } else {
            result = {
                r: parseInt(start.r + progress * (end.r - start.r)),
                g: parseInt(start.g + progress * (end.g - start.g)),
                b: parseInt(start.b + progress * (end.b - start.b))
            };
        }

        return tinycolor(result).toRgbString();
    },

    startFadeAnimation: function(target, fadeIn) {
        var styles = [
            Object.assign({}, target.style || this.options.style),
            Object.assign({}, target.hoverStyle || this.options.hoverStyle)
        ];

        if (!fadeIn) {
            styles = styles.reverse();
        }

        if (target.animation) {
            styles[0] = Object.assign(styles[0], target.animation.styles);

            var index = this.animations.indexOf(target.animation);
            if (index !== -1) {
                this.animations.splice(index, 1);
            }
        }

        if (window.tinycolor) {
            for (var i = 0; i < 2; i++) {
                styles[i].fill   = tinycolor(styles[i].fill).toRgb();
                styles[i].stroke = tinycolor(styles[i].stroke).toRgb();
            }
        }

        (function(self, styles) {
            var animation = {
                target: target,
                styles: Object.assign({}, styles[0]),
                start: performance.now(),
                duration: self.options.hoverSpeed,
                draw: function(progress) {
                    if (target.animation) {
                        target.animation.styles.fillOpacity = styles[0].fillOpacity + progress * (styles[1].fillOpacity - styles[0].fillOpacity);
                        target.animation.styles.strokeOpacity = styles[0].strokeOpacity + progress * (styles[1].strokeOpacity - styles[0].strokeOpacity);
                        target.animation.styles.strokeWidth = styles[0].strokeWidth + progress * (styles[1].strokeWidth - styles[0].strokeWidth);

                        if (window.tinycolor) {
                             target.animation.styles.fill = self.makeProgressColor(styles[0].fill, styles[1].fill, progress);
                             target.animation.styles.stroke = self.makeProgressColor(styles[0].stroke, styles[1].stroke, progress);
                        }

                        self.draw();
                    }
                }
            };

            target.animation = animation;
            self.animations.push(animation);
            self.animate();
        })(this, styles);
    },

    animate: function() {
        var self = this;

        return requestAnimationFrame(function animate(time) {
            var isEnd = true;

            for (var i = 0; i < self.animations.length; i++) {
                var animation = self.animations[i];
                var progress = Math.max(0, Math.min(1, (time - animation.start) / animation.duration));

                animation.draw(progress, animation);

                if (progress < 1) {
                    isEnd = false;
                } else {
                    if (animation.end) {
                        animation.end();
                    }

                    delete animation.target.animation;
                    self.animations.splice(i, 1);
                    i--;
                }
            }

            if (!isEnd) {
                requestAnimationFrame(animate);
            }
        });
    },

    draw: function() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

        var point,
            centerX = this.vxMax * 0.5,
            centerY = this.vyMax * 0.5;

        this.context.globalAlpha = 1;

        this.context.drawImage(
            this.image,
            0, 0,
            this.image.width, this.image.height,
            this.image.virtualOffset.x, this.image.virtualOffset.y,
            this.image.virtualWidth, this.image.virtualHeight
        );

        if (this.options.areas) {
            for (var i = 0; i < this.options.areas.length; i++) {
                var area = this.options.areas[i];

                if (!area.active && !area.style && !area.animation && !this.options.style.fillOpacity && !this.options.style.strokeOpacity) {
                    continue;
                }

                var style;

                if (area.animation) {
                    style = area.animation.styles;
                } else if (area.active) {
                    style = area.hoverStyle || this.options.hoverStyle;
                } else {
                    style = area.style || this.options.style;
                }

                if (window.tinycolor) {
                    var color = tinycolor(style.fill).setAlpha(style.fillOpacity);
                    this.context.fillStyle = color.toRgbString();

                    color = tinycolor(style.stroke).setAlpha(style.strokeOpacity);
                    this.context.strokeStyle = color.toRgbString();
                } else {
                    this.context.globalAlpha = style.fillOpacity;
                    this.context.fillStyle   = style.fill;
                    this.context.strokeStyle = style.stroke;
                }

                this.context.lineWidth = style.strokeWidth;

                if (!this.context.globalAlpha) {
                    continue;
                }

                this.context.beginPath();

                for (var j = 0; j < area.virtCoords.length; j += 2) {
                    if (!j) {
                        this.context.moveTo(area.virtCoords[j], area.virtCoords[j + 1]);
                    } else {
                        this.context.lineTo(area.virtCoords[j], area.virtCoords[j + 1]);
                    }
                }

                this.context.lineTo(area.virtCoords[0], area.virtCoords[1]);

                if (style.strokeWidth) {
                    this.context.stroke();
                }

                this.context.fill();
            }
        }

        var event = new CustomEvent('redrawn', {
            bubbles: true,
            detail: {
                context: this.context
            }
        });

        this.canvas.dispatchEvent(event);
    },



    // map real to virtual
    rmapv: function(x, y) {
        var vx = x / this.zoom + this.offset.x;
        var vy = y / this.zoom + this.offset.y;
        return {x: vx, y: vy};
    },

    // map virtual to real
    vmapr: function(vx, vy) {
        var x = (vx - this.offset.x) * this.zoom;
        var y = (vy - this.offset.y) * this.zoom;
        return {x: x, y: y};
    },

    rscalev: function(n) {
        return n * this.zoom;
    },

    vwidth: function() {
        return this.canvas.width / this.zoom;
    },

    vheight: function() {
        return this.canvas.height / this.zoom;
    }
};
