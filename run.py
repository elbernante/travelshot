from travelshot import app
from travelshot.models import db
from travelshot.utils import datastore as ds

def check_categories():
    '''Create categories if there are none already exist in the database.'''

    category_count = len(ds.get_categories())
    if category_count == 0:
        categories = [
            'Africa',
            'Asia',
            'Middle East',
            'Antartica',
            'Oceana',
            'Europe',
            'Canada',
            'Central America',
            'United States',
            'South America'
        ]
        for c in categories:
            ds.new_category(c)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        check_categories()
    app.run(host='0.0.0.0')
