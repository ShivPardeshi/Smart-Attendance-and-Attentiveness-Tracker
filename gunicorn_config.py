import os

bind = f"0.0.0.0:{os.getenv('PORT', '5001')}"
workers = int(os.getenv('WEB_CONCURRENCY', '2'))
threads = 4
timeout = 120
keepalive = 5
preload_app = False
accesslog = "-"
errorlog = "-"
loglevel = "info"
