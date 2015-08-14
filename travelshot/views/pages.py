'''
Views Module
Contains routes for rendering HTML pages
'''

from flask import Blueprint
from flask import redirect, url_for
from flask import render_template
from .. import app

pages = Blueprint('pages', __name__)

@app.route('/')
@app.route('/index/')
@app.route('/index.html')
@pages.route('/')
def index():
    '''Test route'''
    return render_template('index.html')

@pages.route('/upload/')
def upload():
    '''Test route'''
    return render_template('upload.html')

@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404
