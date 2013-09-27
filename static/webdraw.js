// Websocket-based Drawing App
// Written by: Bill Healey

$(document).ready(function() {
    if (!window.console) window.console = {};
    if (!window.console.log) window.console.log = function() {};
    WebDraw.init();
});

//**************************************************************************
// Webdraw class
//**************************************************************************
var WebDraw = {

    updateDelta: 50, //Only send data every x milliseconds to limit data spamming
    lastUpdate: Date.now(),
    isMobileDevice: null,
    socket: null,
    prevPosition: null,
    canvasPosition: null,
    canvasContext: null,
    isTouched: false,

    //Contains info about the deviceorientation control ranges
    ControllerRange: {
        //Apparently iOS already zeros these out based on the initial position of device
        //included here in-case other devices don't
        alphaCenter: 0,
        betaCenter: 0,

        //Allowed range of the angular sector
        alphaSector: 80,
        betaSector: 80,

        //Scaling factor to map the above sector size to the canvas
        alphaScale: null,
        betaScale: null
    },

    init: function() {
        this.isMobileDevice = this.checkForMobileDevice();
        if (this.isMobileDevice) {
            $('#controller').show();
            this.initColorTable();
            //Get rid of safari address bar
            //setTimeout(function () {
            //    window.scrollTo(0, 1);
            //}, 0);
        } else {
            $('#display').show();
            this.initDraw();
        }

        $(window).on("touchstart", null, {originalThis: this}, this.onTouchChange);
        $(window).on("touchend",  null, {originalThis: this}, this.onTouchChange);
        $(window).on("deviceorientation", null, {originalThis: this}, this.onDeviceOrientation);
        $(window).on("mousemove", null, {originalThis: this}, this.onMouseMove);

        this.initWebSocket();
    },

    initDraw: function() {
        var canvas = $('#canvas')[0];
        canvas.width = document.body.clientWidth;
        canvas.height = document.body.clientHeight;
        this.ControllerRange.betaScale = canvas.height / this.ControllerRange.betaSector;
        this.ControllerRange.alphaScale = canvas.width / this.ControllerRange.alphaSector;
        this.canvasPosition = $(canvas).offset();
        this.canvasContext = canvas.getContext("2d");
        this.canvasContext.lineCap = 'round';
    },

    initWebSocket: function(a) {
        "use strict";
        var url = "ws://" + location.host + "/ws";
        this.socket = new WebSocket(url);
        var ws_class = this;

        if (!this.isMobileDevice) {
            this.socket.onmessage = function(e) {ws_class.draw(e)};
        }
    },

    initColorTable: function(a) {
        "use strict";
        var colors_per_row, colors, tr, i;
        tr = "";
        colors_per_row = 3;
        colors = ['red', 'yellow', 'blue', 'orange', 'white', 'green', 'pink', 'purple', 'brown'];

        while (colors.length) {
            tr += "<tr>";
            for (i = 0; i < colors_per_row; i++) {
                tr += "<td style='background-color: " + colors.pop() + "'></td>";
            }
            tr += "</tr>";
        }

        $(tr).prependTo('#colors');

    },

    onDeviceOrientation: function(event) {
        var now, color;
        now = Date.now();
        if (now - event.data.originalThis.lastUpdate <= event.data.originalThis.updateDelta ||
            !event.originalEvent.alpha ||
            !event.originalEvent.beta) {
            return;
        }
        event.data.originalThis.lastUpdate = now;

        //Erase if device is turned upside-down
        //TODO: rename isTouched to touchColor and send isInverted as 4th data param
        if (Math.abs(event.originalEvent.gamma) > 120 && event.data.originalThis.isTouched)
            color = '#000000';
        else
            color = event.data.originalThis.isTouched;

        var data = [event.originalEvent.alpha.toFixed(3),
                    event.originalEvent.beta.toFixed(3),
                    color];
        WebDraw.socket.send(JSON.stringify(data));
    },

    onTouchChange: function(event) {
        if (event.originalEvent.touches.length > 0) {
            event.data.originalThis.isTouched = $(event.originalEvent.target).css('background-color');
        } else {
            event.data.originalThis.isTouched = false;
        }
        event.preventDefault();
        event.originalEvent.preventDefault();
        return false;
    },

    onMouseMove: function(event) {
        var data = [event.pageX.toFixed(3), event.pageY.toFixed(3)];
    },

    draw: function(event) {

        var coords = JSON.parse(event.data);

        var alpha = coords.body[0];
        var beta = coords.body[1];

        //The alpha range is 0-360 so rotate the center to 180 so that we avoid the modulo seam at 360
        // this way the number space will only wrap around behind the user to prevent jumps
        var alphaRotationFactor = (180 + this.ControllerRange.alphaCenter) % 360;
        alpha = (alpha + alphaRotationFactor) % 360;

        var newPosition = {
            x: (((180 + this.ControllerRange.alphaSector / 2 - alpha + 360) % 360) - 180) * this.ControllerRange.alphaScale,
            y: (this.ControllerRange.betaCenter + this.ControllerRange.betaSector / 2 - beta) * this.ControllerRange.betaScale
        };

        $('#cursor').css({left: this.canvasPosition.left + newPosition.x,
                          top: this.canvasPosition.top + newPosition.y});

        if (!this.prevPosition) {
            this.prevPosition = newPosition;
            return;
        }

        if (!coords.body[2] || coords.body[2] !== "#000000") {
            this.canvasContext.lineWidth = 4;
            $('#cursor').removeClass('eraser');
        }

        if (coords.body[2]) {
            if (coords.body[2] === "#000000") {
                this.canvasContext.lineWidth = 100;
                $('#cursor').addClass('eraser');
            }
            this.canvasContext.beginPath();
            this.canvasContext.moveTo(this.prevPosition.x, this.prevPosition.y);
            this.canvasContext.lineTo(newPosition.x, newPosition.y);
            this.canvasContext.strokeStyle = coords.body[2];
            this.canvasContext.stroke();
        }

        this.prevPosition = newPosition;
    },

    showDebugMessage: function(message) {
        $("#debug").show();
        $("#colors").hide();
        $("#debug").append( '<div class="message">' + String(message) + '</div>');
    },

    checkForMobileDevice: function() {
        var isMobile = false;
        (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)))isMobile = true})(navigator.userAgent||navigator.vendor||window.opera);
        return isMobile;
    }
};



