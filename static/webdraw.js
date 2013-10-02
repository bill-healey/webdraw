// Websocket-based Drawing App
// Written by: Bill Healey

//**************************************************************************
// Webdraw class
//**************************************************************************
var WebDraw = function () {
    "use strict";
    this.isMobileDevice = null;
    this.socket = null;

    this.users = {};

    //Contains info drawing canvas
    this.drawInfo = {
        canvasContext: null,
        canvasPosition: null,
        canvasXScale: null,
        canvasYScale: null
    };

    //Contains info about the deviceorientation control ranges and controller status
    this.controllerInfo = {
        updateDelta: 50, //Only send data every x milliseconds to limit data spamming
        lastUpdate: 0,
        touchColor: false,

        //Apparently iOS already zeros these out based on the initial position of device
        //included here in-case other devices don't
        alphaCenter: 0,
        betaCenter: 0,

        //Allowed range of the angular sectors
        alphaSector: 80,
        betaSector: 80
    };

    this.init = function () {
        this.isMobileDevice = this.checkForMobileDevice();
        if (this.isMobileDevice) {
            $('#controller').show();
            this.initColorTable();
            //Get rid of safari address bar
            //window.scrollTo(0, 1);
        } else {
            $('#display').show();
            this.initDraw();
        }

        $(window).on("touchstart", null, {originalThis: this}, this.onTouchChange);
        $(window).on("touchend",  null, {originalThis: this}, this.onTouchChange);
        $(window).on("deviceorientation", null, {originalThis: this}, this.onDeviceOrientation);
        $(window).on("mousemove", null, {originalThis: this}, this.onMouseMove);

        this.initWebSocket();
    };

    this.initDraw = function () {
        var canvas = $('#canvas')[0];
        canvas.width = document.body.clientWidth;
        canvas.height = document.body.clientHeight;
        this.drawInfo.canvasXScale = canvas.width / 100;
        this.drawInfo.canvasYScale = canvas.height / 100;
        this.drawInfo.canvasPosition = $(canvas).offset();
        this.drawInfo.canvasContext = canvas.getContext("2d");
        this.drawInfo.canvasContext.lineCap = 'round';
    };

    this.initWebSocket = function () {
        var url = "ws://" + location.host + "/ws";
        this.socket = new WebSocket(url);
        var wsClass = this;

        if (!this.isMobileDevice) {
            this.socket.onmessage = function (e) {wsClass.draw(e); };
        }
    };

    this.initColorTable = function () {
        var colorsPerRow, colors, tr, i;
        tr = "";
        colorsPerRow = 3;
        colors = ['red', 'yellow', 'blue', 'orange', 'white', 'green', 'pink', 'purple', 'brown'];

        while (colors.length) {
            tr += "<tr>";
            for (i = 0; i < colorsPerRow; i++) {
                tr += "<td style='background-color: " + colors.pop() + "'></td>";
            }
            tr += "</tr>";
        }

        $(tr).prependTo('#colors');
    };

    this.onDeviceOrientation = function (event) {
        var now, isDeviceInverted, t, alphaRotationFactor, a, b, x, y;
        t = event.data.originalThis;
        now = Date.now();
        a = event.originalEvent.alpha;
        b = event.originalEvent.beta;

        if (now - t.controllerInfo.lastUpdate <= t.controllerInfo.updateDelta || !a || !b) {
            return;
        }

        t.controllerInfo.lastUpdate = now;

        isDeviceInverted = (Math.abs(event.originalEvent.gamma) > 120);

        //The alpha range is 0-360 so rotate the center to 180 so that we avoid the modulo seam at 360
        // this way the number space will only wrap around behind the user to prevent jumps
        alphaRotationFactor = (180 + t.controllerInfo.alphaCenter) % 360;
        a = (a + alphaRotationFactor) % 360;

        x = (180 + t.controllerInfo.alphaSector / 2 - a) * (100 / t.controllerInfo.alphaSector);
        y = (t.controllerInfo.betaCenter + t.controllerInfo.betaSector / 2 - b) * (100 / t.controllerInfo.betaSector);

        var data = [x.toFixed(3),
                    y.toFixed(3),
                    t.controllerInfo.touchColor,
                    isDeviceInverted];


        t.socket.send(JSON.stringify(data));
    };

    this.onTouchChange = function (event) {
        if (event.originalEvent.touches.length > 0) {
            event.data.originalThis.controllerInfo.touchColor = $(event.originalEvent.target).css('background-color');
        } else {
            event.data.originalThis.controllerInfo.touchColor = false;
        }
        event.preventDefault();
        event.originalEvent.preventDefault();
        return false;
    };

    this.onMouseMove = function(event) {
        var now, isDeviceInverted, x, y;
        now = Date.now();

        if (now - event.data.originalThis.lastUpdate <= event.data.originalThis.updateDelta ||
            !event.pageX ||
            !event.pageY) {
            return;
        }

        event.data.originalThis.lastUpdate = now;

        if (!event.data.originalThis.packetTimestamp) {
            event.data.originalThis.packetTimestamp = now;
        }

        isDeviceInverted = (Math.abs(event.originalEvent.gamma) > 120);

        x = event.pageX * (100 / $(window).width());
        y = event.pageY * (100 / $(window).height());

        var data = [x.toFixed(3),
            y.toFixed(3),
            event.data.originalThis.touchColor,
            isDeviceInverted];

        event.data.originalThis.socket.send(JSON.stringify(data));
    };

    this.draw = function(event) {
        var data, x, y, c, color, isEraser, clientName, scaledPos;

        data = JSON.parse(event.data);

        x = data.d[0];
        y = data.d[1];
        color = data.d[2];
        isEraser = data.d[3];
        clientName = data.u;

        if (!this.users[clientName]) {
            //Generate a random color
            c = Math.round(0xFFFFFF * Math.random()).toString(16);

            this.users[clientName] = {
                id: Object.keys(this.users).length,
                pos: {x: x, y: y},
                lastSeen: Date.now(),
                nameColor: "#" + "000000".substring(0, 6 - c.length) + c
            };
        }

        scaledPos = {
            x: x * this.drawInfo.canvasXScale,
            y: y * this.drawInfo.canvasYScale
        };

        $('#cursor').css({left: this.drawInfo.canvasPosition.left + scaledPos.x,
                          top: this.drawInfo.canvasPosition.top + scaledPos.y});

        $('#cursortext').text(clientName + String(this.users[clientName].id));
        $('#cursortext').css({color: this.users[clientName].nameColor});

        if (isEraser) {
            this.drawInfo.canvasContext.lineWidth = 100;
            $('#cursor').addClass('eraser');
            this.drawInfo.canvasContext.strokeStyle = "#000000";
        } else {
            this.drawInfo.canvasContext.lineWidth = 4;
            $('#cursor').removeClass('eraser');
            this.drawInfo.canvasContext.strokeStyle = color;
        }

        if (color) {
            this.drawInfo.canvasContext.beginPath();
            this.drawInfo.canvasContext.moveTo(this.users[clientName].pos.x * this.drawInfo.canvasXScale,
                                               this.users[clientName].pos.y * this.drawInfo.canvasYScale);
            this.drawInfo.canvasContext.lineTo(scaledPos.x, scaledPos.y);
            this.drawInfo.canvasContext.stroke();
        }

        this.users[clientName].lastSeen = Date.now();
        this.users[clientName].pos.x = x;
        this.users[clientName].pos.y = y;
    };

    this.showDebugMessage = function (message) {
        $("#debug").show();
        $("#colors").hide();
        $("#debug").append('<div class="message">' + String(message) + '</div>');
    };

    this.checkForMobileDevice = function() {
        var isMobile = false;
        (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)))isMobile = true})(navigator.userAgent||navigator.vendor||window.opera);
        return isMobile;
    };
};

$(document).ready(function() {
    "use strict";
    var webDraw = new WebDraw();
    webDraw.init();
});

