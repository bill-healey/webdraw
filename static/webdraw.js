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
    // Defines
    updateDelta: 200, //Only send data every x milliseconds to limit data spamming

    // Private variables
    lastUpdate: Date.now(),
    isMobileDevice: null,
    socket: null,
    prevX: null,
    prevY: null,
    context: null,
    isTouched: false,

    // Methods
    init: function() {
        this.isMobileDevice = this.checkForMobileDevice();
        if (this.isMobileDevice) {
            $('#inbox').show();
        } else {
            $('#canvas').show();
            this.initDraw();
        }

        $(window).on("touchstart", this.onTouchChange);
        $(window).on("touchend", this.onTouchChange);
        $(window).on("deviceorientation", this.onDeviceOrientation);
        //$(window).on("mousemove", this.onMouseMove);
        this.initWebSocket();

    },

    initDraw: function() {
        var canvas = $('#canvas');
        ControllerRange.vScale = canvas.height() / (ControllerRange.maxBeta - ControllerRange.minBeta);
        ControllerRange.hScale = canvas.width() / ((ControllerRange.maxAlpha - ControllerRange.minAlpha + 360) % 360);
        this.context = canvas[0].getContext("2d");
        this.context.lineWidth = 3;
        this.context.strokeStyle = "#FFFFFF";
    },

    initWebSocket: function(a) {
        var url = "ws://" + location.host + "/ws";
        this.socket = new WebSocket(url);
        ws_class = this;

        if (this.isMobileDevice) {
            //this.socket.onmessage = this.showMessage;
        } else {
            this.socket.onmessage = function(e) {ws_class.draw(e)};
        }
    },

    onDeviceOrientation: function(event) {
        var now = Date.now();
        if (this.now - this.last_update < this.update_delta ||
            !event.originalEvent.alpha ||
            !event.originalEvent.beta ||
            !this.isTouched) {
            return;
        }
        this.last_update = now;
        var data = [event.originalEvent.alpha.toFixed(3), event.originalEvent.beta.toFixed(3)];
        WebDraw.socket.send(JSON.stringify(data));
    },

    onTouchChange: function(event) {
        if (event.originalEvent.touches.length > 0) {
            this.isTouched = true;
        } else {
            this.isTouched = false;
            var data = [0];
            WebDraw.socket.send(JSON.stringify(data));
        }
        event.preventDefault();
        event.originalEvent.preventDefault();
        return false;
    },

    onMouseMove: function(event) {
        var now = Date.now();
        if (this.now - this.last_update < this.update_delta) {
            return;
        }
        this.last_update = now;
        var data = [event.pageX.toFixed(3), event.pageY.toFixed(3)];
        WebDraw.socket.send(JSON.stringify(data));
    },

    draw: function(event) {

        var coords = JSON.parse(event.data);

        if (coords.body.length < 2) {
            this.prevX = null;
            this.prevY = null;
            return;
        }

        var rawX = coords.body[0];
        var rawY = coords.body[1];

        if (ControllerRange.maxAlpha > ControllerRange.minAlpha) {
            if (rawX < ControllerRange.minAlpha || rawX > ControllerRange.maxAlpha)
                return;
        } else {
            if (rawX > ControllerRange.maxAlpha && rawX < ControllerRange.minAlpha)
                return;
        }

        var xCoord = ((ControllerRange.maxAlpha - rawX + 360) % 360) * ControllerRange.hScale;
        var yCoord = (ControllerRange.maxBeta - rawY) * ControllerRange.vScale;

        if (this.prevX === null || this.prevY === null) {
            this.prevX = xCoord;
            this.prevY = yCoord;
            return;
        }

        this.context.beginPath();
        this.context.moveTo(this.prevX, this.prevY);
        this.context.lineTo(xCoord, yCoord);
        this.context.stroke();

        this.prevX = xCoord;
        this.prevY = yCoord;

    },

    showMessage: function(event) {
        var message = JSON.parse(event.data);
        var existing = $("#m" + message.id);
        if (existing.length > 0) return;
        var node = $(message.html);
        node.hide();
        $("#inbox").append(node);
        node.slideDown();
    },

    checkForMobileDevice: function() {
        var check = false;
        (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)))check = true})(navigator.userAgent||navigator.vendor||window.opera);
        return check;
    }
};

var ControllerRange = {
    maxAlpha: 40,
    minAlpha: 320,
    minBeta: -40,
    maxBeta: 40,
    vScale: null,
    hScale: null
};

