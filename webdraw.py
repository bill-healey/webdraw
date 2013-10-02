"""Websocket-based Drawing App
Written by: Bill Healey
This code is based on the tornado auth and websocket demos
"""

import logging
import tornado.auth
import tornado.escape
import tornado.ioloop
import tornado.options
import tornado.web
import tornado.websocket
import os.path
import uuid

from tornado.options import define, options
from tornado import gen

define("port", default=8888, help="run on the given port", type=int)


class Application(tornado.web.Application):
    def __init__(self):
        handlers = [
            (r"/", MainHandler),
            (r"/ws", DrawSocketHandler),
            (r"/auth/login", AuthHandler),
            (r"/auth/logout", LogoutHandler),
        ]
        settings = dict(
            cookie_secret="CBpdzJGPHu62rZvuvYnAA6hC",
            template_path=os.path.join(os.path.dirname(__file__), "templates"),
            static_path=os.path.join(os.path.dirname(__file__), "static"),
            xsrf_cookies=True,
            login_url="/auth/login",
        )
        tornado.web.Application.__init__(self, handlers, **settings)


class BaseHandler(tornado.web.RequestHandler):
    def get_current_user(self):
        user_json = self.get_secure_cookie('webdraw_user')
        if not user_json:
            return None
        return tornado.escape.json_decode(user_json)


class MainHandler(BaseHandler):
    @tornado.web.authenticated
    def get(self):
        self.render("index.html", messages=DrawSocketHandler.cache)


class AuthHandler(BaseHandler, tornado.auth.GoogleMixin):
    @tornado.web.asynchronous
    @gen.coroutine
    def get(self):
        if self.get_argument("openid.mode", None):
            user = yield self.get_authenticated_user()
            self.set_secure_cookie('webdraw_user',
                                   tornado.escape.json_encode(user))
            self.redirect('/')
        else:
            self.authenticate_redirect()


class LogoutHandler(BaseHandler):
    #This logs the user out of the app but google will auto-relog them back in so it isn't very useful
    def get(self):
        self.clear_cookie('webdraw_user')
        self.write('You are now logged out.'
                   'Click <a href="/">here</a> to log back in.')


class DrawSocketHandler(tornado.websocket.WebSocketHandler):

    waiters = set()
    cache = []
    cache_size = 200

    def allow_draft76(self):
        # for iOS 5.0 Safari
        return True

    def open(self):
        DrawSocketHandler.waiters.add(self)

    def on_close(self):
        DrawSocketHandler.waiters.remove(self)

    @classmethod
    def update_cache(cls, msg):
        cls.cache.append(msg)
        if len(cls.cache) > cls.cache_size:
            cls.cache = cls.cache[-cls.cache_size:]

    @classmethod
    def send_updates(cls, msg):
        logging.info("sending message to %d waiters", len(cls.waiters))
        for waiter in cls.waiters:
            try:
                waiter.write_message(msg)
            except:
                logging.error("Error sending message", exc_info=True)

    def on_message(self, message):
        logging.info("msg: %r", message)
        user_json = self.get_secure_cookie('webdraw_user')
        if not user_json:
            return

        user = tornado.escape.json_decode(user_json)
        parsed = tornado.escape.json_decode(message)
        msg = {
            "d": parsed,
            "u": user['name']
            }
        DrawSocketHandler.update_cache(msg)
        DrawSocketHandler.send_updates(msg)


def main():
    tornado.options.parse_command_line()
    app = Application()
    app.listen(options.port)
    tornado.ioloop.IOLoop.instance().start()


if __name__ == "__main__":
    main()
