'''
Views Module
Contains routes for rendering HTML pages
'''

from flask import render_template

from .. import app

from ..utils import util

@app.route('/')
@app.route('/index/')
@app.route('/index.html')
@util.smart_request
def index():
    '''Test route'''
    return {'pagetype': 'homepage'}

@app.route('/favicon.ico')
def favicon():
    return app.send_static_file('images/favicon.ico')

@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404
