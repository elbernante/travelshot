Travel Shot
======================================

Web application for sharing travel photos.
Project 3 for Udacity Full Stack Nano Degree.
Developed with Flask and SQLAlchemy, and using third party authentication services (G Plus and Facebook).


Setting Up
--------------------------------------

### Environment Requirements

The following needs to be installed:

- Git
- Python 2.7

Python Libraries:
- Flask 0.10.1
- SQLAlchemy 0.8.4
- oauth2client 1.4.12
- requests 2.2.1


### Getting the Source Code

Clone a copy of the main Movie Index git repo by running:

```bash
git clone https://github.com/elbernante/travelshot.git
```


### Setting up the database

No setup needed for the database.

This app is using SQLite (for easier review setup purposes only; the configuration can be changed to use PostgreSQL) database which will be automatically created (if it doesn't already exists) when the server is launched.

The categories that are used in the app are also automatically created in the database when the server is run.



### Launching the Server

After getting the source code, in the command line, go to the directory of ```travelshot/``` and run the command:

```bash
python run.py
```

The server should now be up and running and can be accessed through ```http://localhost:5000```. The port may change if it is already in use.



### Browser Support

The front-end was tested on the following browsers. Other browsers might work, but are not tested. IE is not supported.

- Chrome version 44 (on Mac)
- Safari version 8 (on Mac)


Features
--------------------------------------
- Uses third party authentication service (G Plus and Facebook)
- Key endpoints are protected from Cross-Site Request Forgery (CSRF)
- Supports JSON and XML API endpoints
- Supports Atom Feed for latest items and per category
- Create items with images
- Retrieve/Update items including images
- Delete items is implemented using POST request method and is protected from CSRF and uses nonce to prevent duplicate delete request
