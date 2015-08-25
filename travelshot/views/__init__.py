'''
Views Module
Contains routes for rendering HTML pages
'''

from flask import redirect, url_for
from flask import render_template

from .. import app

@app.route('/')
@app.route('/index/')
@app.route('/index.html')
def index():
    '''Test route'''
    # return redirect(url_for('pages.index'))
    return render_template('index.html')

@app.route('/favicon.ico')
def favicon():
    return app.send_static_file('images/favicon.ico')

@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404
