'''
Views Module
Contains end points for rendering HTML pages.

This module only contains end point for index. The rest of the view end points
are contained in `pages` BluePrint and can be found in pages module.
'''

from flask import render_template
from .. import app
from ..utils import util

@app.route('/')
@app.route('/index/')
@app.route('/index.html')
@util.smart_request
def index():
    '''Home page end point'''
    return {'pagetype': 'homepage'}


@app.route('/favicon.ico')
def favicon():
    '''Returns favicon.ico resource file.'''
    return app.send_static_file('images/favicon.ico')


@app.errorhandler(404)
def page_not_found(error):
    '''Generic 404 error handler. Returns a 404 HTML page.'''
    return render_template('404.html'), 404
