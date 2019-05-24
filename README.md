webdraw
=======

This app requires both a smartphone and an additional computing device capable of showing a webpage.

One or more smartphones can be used as paintbrushes in 3d space to draw collaboratively on a shared canvas.  The position of the 'brush' is based on the position of the phone when the webpage is first initialized.  Colors can be selected via the smartphone display.


Webdraw.py implements a small websocket server powered by Tornado.  It uses Facebook or Google Auth for user-management and login, but those likely need to be updated.

Webdraw.js automatically detects whether the device is a smartphone or desktop/laptop and will act as either a paintbrush or display respectively.
