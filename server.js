var express = require('express');
var http = require('http');
var session = require('cookie-session'); // Loads the piece of middleware for sessions
var bodyParser = require('body-parser'); // Loads the piece of middleware for managing the settings
var urlencodedParser = bodyParser.urlencoded({ extended: false });
var formidable = require('formidable');
var fs = require('fs');
var mongo = require('mongodb');
var MongoClient = require('mongodb').MongoClient;
var CryptoJS = require('crypto-js');
var bcrypt = require('bcrypt');
var SALT_WORK_FACTOR = 10;
var moment = require('moment');

var url = "mongodb://irene_gohtami:Irene6625023@ds141654.mlab.com:41654/deconds";

var app = express();
var server = http.Server(app);
app.use(session({secret: 'deconds_session'}))
.use(function(req, res, next){
    if (typeof(req.session.signup_success) == 'undefined') { //create the session
        req.session.signup_success = false;
    }
	if (typeof(req.session.logged_in) == 'undefined') {
        req.session.logged_in = false;
    }
	if (typeof(req.session.user_id) == 'undefined') {
        req.session.user_id = '';
    }
	if (typeof(req.session.user_group) == 'undefined') {
        req.session.user_group = '';
	}
	if (typeof(req.session.company_name) == 'undefined') {
        req.session.company_name = '';
    }
    next();
})
.use(express.static(__dirname))
.use('/modules', express.static(__dirname + '/node_modules'))
.use('/scripts', express.static(__dirname + '/views/scripts'))
.use('/css', express.static(__dirname + '/views/css'))
.use('/images', express.static(__dirname + '/views/images'));

app.get('/', function(req, res) {
    res.render('index.ejs', {page: req.url, session: req.session});
})
.get('/login', function(req, res) {
	res.render('login.ejs', {page: req.url, session: req.session, error_msg: ''});
})
.get('/logout', function(req, res) {
	req.session = null;
    res.redirect('/');
})
.get('/business', function(req, res) {
	var query = { user_group: "business" };
	listCollection('users', query, '', 'company_name', function(companyList) {
		res.render('business.ejs', {page: req.url, companyList: companyList, session: req.session, error_msg: ''});
	});
})
.get('/business/:id', function(req, res) {
	var query = { _id: parseInt(req.params.id) };
	listCollection('users', query, '', '', function(companyData) {
		var query2 = { company_id: parseInt(companyData[0]._id) };
		listCollection('branch', query2, 'branch_name', 'branch_name', function(branchList) {
			res.render('view_business.ejs', {page: req.url, companyData: companyData[0], branchList: branchList, session: req.session, error_msg: ''});
		});
	});
})
.get('/signup/:account_type', function(req, res) {
	if(req.params.account_type == 'business'){
		res.render('signup_business.ejs', {page: req.url, session: req.session});
	}else if(req.params.account_type == 'staff'){
		var query = { user_group: "business" };
		listCollection('users', query, 'company_name', 'company_name', function(companyList) {
			res.render('signup_staff.ejs', {page: req.url, companyList: companyList, session: req.session});
		});
	}else if(req.params.account_type == 'customer'){
		res.render('signup_customer.ejs', {page: req.url, session: req.session});
	}else if(req.params.account_type == 'success' && req.session.signup_success == true){
		res.render('signup_success.ejs', {page: req.url, session: req.session});
	}else{
		res.render('error_404.ejs', {page: req.url, session: req.session});
	}
})
.get('/checkDuplicateName/:collection/:field_name/:name', function(req, res) {
    if(req.params.collection && req.params.field_name && req.params.name) {
		MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
			if (err) throw err;
			var dbo = db.db('deconds');
			var objCol = dbo.collection(req.params.collection);
			var query = {};
			query[req.params.field_name] = req.params.name;

			objCol.find(query).toArray(function(err, result) {
				if (err) throw err;
				db.close();
				if(result.length > 0){
					res.send(true);
				}else{
					res.send(false);
				}
			});
		});
	}
})
.get('/checkDuplicateName/:collection/:field_name/:name/:id', function(req, res) {
    if(req.params.collection && req.params.field_name && req.params.name){
		MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
			if (err) throw err;
			var dbo = db.db('deconds');
			var objCol = dbo.collection(req.params.collection);
			var query = {};
			query[req.params.field_name] = req.params.name;
			query['company_id'] = req.session.user_id;

			if(req.params.id){
				query['_id'] =  { '$ne': parseInt(req.params.id) };
			}

			objCol.find(query).toArray(function(err, result) {
				if (err) throw err;
				db.close();
				if(result.length > 0){
					res.send(true);
				}else{
					res.send(false);
				}
			});
		});
	}
})
.get('/dashboard', function(req, res) {
	res.render('bo/dashboard.ejs', {page: req.url, session: req.session, error_msg: ''});
})
.get('/branch', function(req, res) {
	res.render('bo/branch.ejs', {page: req.url, session: req.session, error_msg: ''});
})
.get('/department', function(req, res) {
	res.render('bo/department.ejs', {page: req.url, session: req.session, error_msg: ''});
})
.get('/user_group', function(req, res) {
	res.render('bo/user_group.ejs', {page: req.url, session: req.session, error_msg: ''});
})
.get('/hierarchy', function(req, res) {
	res.render('bo/hierarchy.ejs', {page: req.url, session: req.session, error_msg: ''});
})
.get('/staff', function(req, res) {
	var query = { company_id: parseInt(req.session.user_id) };
	listCollection('branch', query, 'branch_name', 'branch_name', function(branchList) {
		listCollection('department', query, 'department_name', '', function(departmentList) {
			listCollection('usergroup', query, 'usergroup_name','', function(userGroupList) {
				listCollection('hierarchy', query, 'hierarchy_name', '', function(hierarchyList) {
					res.render('bo/staff.ejs', {page: req.url, branchList: branchList, departmentList: departmentList, userGroupList: userGroupList, hierarchyList: hierarchyList, session: req.session, error_msg: ''});
				});
			});
		});
	});
})
.get('/staff_dashboard', function(req, res) {
	var searchStr = { 
		$match: { //for lookup, searchStr require '$match' & '$and' keyword
			$and: [{
				staff_id: req.session.user_id
			}]
		}
	};
	var fieldSelection = {
		$project: {
			"_id": 1,
			"date": 1,
			"time": 1,
			"remarks": 1,
			"customer_details.first_name" : 1,
			"customer_details.last_name" : 1
		}
	};
	listMultiCollection('appointment_schedule', 'users', 'customer_id', '_id', 'customer_details', fieldSelection, searchStr, 'date', function(appointmentList) {
		console.log(appointmentList);
		res.render('bo/staff_dashboard.ejs', {page: req.url, appointmentList: appointmentList, session: req.session, error_msg: ''});
	});	
})
.get('/working_schedule', function(req, res) {
	res.render('bo/working_schedule.ejs', {page: req.url, session: req.session, error_msg: ''});
})
.get('/ajax/list/:collection', function(req, res) {
	var sortCol = req.query.order[0].column;
	var sortDir = req.query.order[0].dir;
	var columnName = req.query.columns[sortCol].name;
	var sortStr = {};
		sortStr[columnName] = (sortDir=='asc' ? 1 : -1);
	var search = req.query.search.value;
	if(search){
		var regex = new RegExp(search, "i");
		if(req.params.collection == 'branch'){
			var searchStr = { $match: {$and: [{$or: [{'branch_name': regex }, {'branch_location': regex}]}, {company_id: req.session.user_id}] } };
		}else if(req.params.collection == 'department'){
			var searchStr = { $and: [{'department_name': regex}, {company_id: req.session.user_id}] };
		}else if(req.params.collection == 'usergroup'){
			var searchStr = { $and: [{'usergroup_name': regex}, {company_id: req.session.user_id}] };
		}else if(req.params.collection == 'hierarchy'){
			var searchStr = { $and: [{'hierarchy_name': regex}, {company_id: req.session.user_id}] };
		}else if(req.params.collection == 'working_schedule'){
			var searchStr = { $and: [{'day': regex}, {staff_id: req.session.user_id}] };
		}
	}else{
        if(req.params.collection == 'working_schedule'){
            var searchStr = { staff_id: req.session.user_id };
        }else{
            var searchStr = { company_id: req.session.user_id };
        }
	}
	 
	MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
		if (err) throw err;
		var dbo = db.db('deconds');
        var objCol = dbo.collection(req.params.collection);
        
        if(req.params.collection == 'working_schedule'){
            var dayNumeric = [];
            dayNumeric[1] = 'Monday';
            dayNumeric[2] = 'Tuesday';
            dayNumeric[3] = 'Wednesday';
            dayNumeric[4] = 'Thursday';
            dayNumeric[5] = 'Friday';
            dayNumeric[6] = 'Saturday';
            dayNumeric[7] = 'Sunday';
        }
		
		objCol.countDocuments({}, function(err, c) {
			var recordsTotal = c;
			objCol.countDocuments(searchStr, function(err, c) {
				var recordsFiltered = c;
				
				objCol.find(searchStr, {'skip': Number( req.query.start), 'limit': Number(req.query.length)}).sort(sortStr).toArray(function(err, result) {
					if (err) throw err;
					db.close();
					for(var i=0; i<result.length; i++){
                        result[i].no = i+1;
                        if(req.params.collection == 'working_schedule'){
                            result[i].day_display = dayNumeric[result[i].day];
                        }
					}
					var data = JSON.stringify({
						"draw": req.query.draw,
						"recordsFiltered": recordsFiltered,
						"recordsTotal": recordsTotal,
						"data": result
					});
					res.send(data);
				});
			});
		});
	});
})
.get('/ajax/list_multi/staff', function(req, res) {
	var sortCol = req.query.order[0].column;
	var sortDir = req.query.order[0].dir;
	var columnName = req.query.columns[sortCol].name;
	var sortStr = {};
	if(columnName=='branch' || columnName=='department' ||columnName=='usergroup' ||columnName=='hierarchy'){
		sortStr['staff_details.'+columnName] = (sortDir=='asc' ? 1 : -1);
	}else{
		sortStr[columnName] = (sortDir=='asc' ? 1 : -1);
	}
	var search = req.query.search.value;
	if(search){
		var regex = new RegExp(search, "i");
		var searchStr = { 
			$match: {
				$and: [{
					$or: [{'first_name': regex }, {'last_name': regex}, {'gender': regex}, {'email': regex}, {'phone': regex}, {'status': regex}, {'staff_details.branch': regex}, {'staff_details.department': regex}, {'staff_details.usergroup': regex}, {'staff_details.hierarchy': regex}]
				},{
					company_name: req.session.company_name 
				},{
					user_group: 'staff'
				}]
			}
		};
	}else{
		var searchStr = { 
			$match: {
				$and: [{
					company_name: req.session.company_name 
				},{ 
					user_group: 'staff' 
				}]
			}
		};
	}
	
	MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
		if (err) throw err;
		var dbo = db.db('deconds');
		var objCol = dbo.collection('users');
		
		objCol.aggregate([{
			$lookup:
				{
					from: 'staff',
					localField: '_id',
					foreignField: '_id',
					as: 'staff_details'
				}
			},{
				$unwind: "$staff_details"
			}, searchStr
		], {'skip': Number( req.query.start), 'limit': Number(req.query.length)}).sort(sortStr).toArray(function(err, result) {
			if (err) throw err;
			db.close();
			for(var i=0; i<result.length; i++){
				result[i].no = i+1;
			}
			var data = JSON.stringify({
				"draw": req.query.draw,
				"recordsFiltered": result.length,
				"recordsTotal": result.length,
				"data": result
			});
			res.send(data);
		});
	});
})
.get('/ajax/loadCompanyData/:companyId', function(req, res) {
	var query = { company_id: parseInt(req.params.companyId) };
	listCollection('branch', query, 'branch_name', 'branch_name', function(branchList) {
		listCollection('department', query, 'department_name', '', function(departmentList) {
			listCollection('usergroup', query, 'usergroup_name','', function(userGroupList) {
				listCollection('hierarchy', query, 'hierarchy_name', '', function(hierarchyList) {
					var data = {};
					data['branch'] = branchList;
					data['department'] = departmentList;
					data['usergroup'] = userGroupList;
					data['hierarchy'] = hierarchyList;
					res.send(data);
				});
			});
		});
	});
})
.get('/ajax/listStaffByBranch/:companyName/:branch', function(req, res) {
	var searchStr = { 
		$match: { 
			$and: [{
				'company_name': req.params.companyName
			},{ 
				'user_group': 'staff'
			},{ 
				'staff_details.branch': req.params.branch
			}]
		}
	};
	var sortStr = {};
	sortStr['first_name'] = 1;

	MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
		if (err) throw err;
		var dbo = db.db('deconds');
		var objCol = dbo.collection('users');
		
		objCol.aggregate([{
			$lookup:
				{
					from: 'staff',
					localField: '_id',
					foreignField: '_id',
					as: 'staff_details'
				}
			}, searchStr
		]).sort(sortStr).toArray(function(err, result) {
			if (err) throw err;
			db.close();
			for(var i=0; i<result.length; i++){
				if(result[i].staff_details[0]){
					result[i].branch = result[i].staff_details[0].branch;
					result[i].department = result[i].staff_details[0].department;
					result[i].usergroup = result[i].staff_details[0].usergroup;
					result[i].hierarchy = result[i].staff_details[0].hierarchy;
				}else{
					result[i].branch = null;
					result[i].department = null;
					result[i].usergroup = null;
					result[i].hierarchy = null;
				}
			}
			res.send(result);
		});
	});
})
.get('/ajax/listStaffSchedule/:id', function(req, res) {
    var searchStr = { staff_id: parseInt(req.params.id) };

	MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
		if (err) throw err;
		var dbo = db.db('deconds');
		var objCol = dbo.collection('working_schedule');
		
		objCol.find(searchStr).toArray(function(err, result) {
            if (err) throw err;
            db.close();
            var disabledDays = [1,2,3,4,5,6,0];
            for(var i=0; i<result.length; i++){
                if(result[i].day == 7){
                    result[i].day = 0; //Sunday
                }
                var index = disabledDays.indexOf(result[i].day);
                if(index > -1){
                    disabledDays.splice(index, 1);
                }
                result[i].disabled_days = disabledDays;
            }
            res.send(result);
        });
	});
})
.get('/ajax/listStaffAppointment/:id/:date', function(req, res) {
	var searchStr = { $and: [{staff_id: parseInt(req.params.id)}, {date: moment(req.params.date, 'YYYY-MM-DD').format('DD/MM/YYYY')}] };

	MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
		if (err) throw err;
		var dbo = db.db('deconds');
		var objCol = dbo.collection('appointment_schedule');
		
		objCol.find(searchStr).toArray(function(err, result) {
            if (err) throw err;
            db.close();
            var disabledTime = [];
            for(var i=0; i<result.length; i++){
				disabledTime.push(result[i].time);
            }
            res.send(disabledTime);
        });
	});
})
/***POST***/
.post('/login/validate', urlencodedParser, function(req, res) {
	if(req.body.username != ''){
		MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
			if (err) throw err;
			var dbo = db.db('deconds');
			var usersCol = dbo.collection('users');
			var query = { username: req.body.username };

			usersCol.find(query).toArray(function(err, result) {
				if (err) throw err;
				db.close();
				if(result.length > 0){
					bcrypt.compare(req.body.password, result[0].password, function(err, res2){
						if(res2 === true){
							req.session.logged_in = true;
							req.session.user_id = result[0]._id;
							req.session.user_group = result[0].user_group;
							if(result[0].user_group == 'business'){
								req.session.company_name = result[0].company_name;
								res.redirect('/dashboard');
							}else if(result[0].user_group == 'staff'){
								res.redirect('/staff_dashboard');
							}else{
								res.redirect('/');
							}
						}else{
							res.render('login.ejs', {page: req.url, session: req.session, error_msg: 'Wrong username or password.'});
						}
					});
				}else{
					res.render('login.ejs', {page: req.url, session: req.session, error_msg: 'Wrong username or password.'});
				}
			});
		});
	}
})
.post('/signup/type', urlencodedParser, function(req, res) {
	if(req.body.account_type != ''){
		res.redirect('/signup/' + req.body.account_type);
	}
})
.post('/signup/business', function(req, res) { //process signup for business account
	var data = {};
	var form = new formidable.IncomingForm();
	form.parse(req)
	.on('file', function (name, file){
		if(file.name != ""){ //company_logo
			var oldpath = file.path;
			var newpath = __dirname + '/uploads/' + file.name;
			fs.rename(oldpath, newpath, function (err) {
				if (err) throw err;
				console.log('File uploaded.');
			});
		}
		data[name] = file.name;
    })
	.on('field', (name, value) => {
		data[name] = value;
    })
	.on('aborted', () => {
		console.error('Request aborted by the user');
    })
    .on('error', (err) => {
		console.error('Error', err);
		throw err;
    })
    .on('end', () => {
		console.log(data);
		MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
			if (err) throw err;
			var dbo = db.db('deconds');
			var usersCol = dbo.collection('users');
			usersCol.find({}).sort({_id:-1}).limit(1).toArray(function(err, result) {
				if(err) throw err;
				if(result.length > 0){
					var id = result[0]._id + 1;
				}else{
					var id = 1;
				}
				var enPass = '';
				bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt){
					if(err) return next(err);
					bcrypt.hash(data.password, salt, function(err, hash){
						if(err) return next(err);
						enPass = hash;
						
						var document = { _id: id, username:data.username, password:enPass, first_name:'', last_name:'', gender:'', dob:'', company_name:data.company_name, industry:data.industry, address:data.company_address, phone:data.company_phone, email:data.customer_enquiry_email, logo:data.company_logo, user_group:'business', status:'Active' };
						usersCol.insertOne(document, function(err, res2) {
							if(err) throw err;
							else{
								console.log("User inserted.");
								req.session.signup_success = true;
								res.redirect('/signup/success');
							}
							db.close();
						});
					});
				});
			});
		});
    });
})
.post('/signup/staff', function(req, res) { //process signup for staff account
	var data = {};
	var form = new formidable.IncomingForm();
	form.parse(req)
	.on('file', function (name, file){
		if(file.name != ""){ //file upload
			var oldpath = file.path;
			var newpath = __dirname + '/uploads/' + file.name;
			fs.rename(oldpath, newpath, function (err) {
				if (err) throw err;
				console.log('File uploaded.');
			});
		}
		data[name] = file.name;
    })
	.on('field', (name, value) => {
		data[name] = value;
    })
	.on('aborted', () => {
		console.error('Request aborted by the user');
    })
    .on('error', (err) => {
		console.error('Error', err);
		throw err;
    })
    .on('end', () => {
		console.log(data);
		MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
			if (err) throw err;
			var dbo = db.db('deconds');
			var usersCol = dbo.collection('users');
			var staffCol = dbo.collection('staff');
			usersCol.find({}).sort({_id:-1}).limit(1).toArray(function(err, result) {
				if(err) throw err;
				if(result.length > 0){
					var id = result[0]._id + 1;
				}else{
					var id = 1;
				}
				var enPass = '';
				bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt){
					if(err) return next(err);
					bcrypt.hash(data.password, salt, function(err, hash){
						if(err) return next(err);
						enPass = hash;
						
						var document = { _id: id, username:data.username, password:enPass, first_name:data.first_name, last_name:data.last_name, gender:data.gender, dob:data.dob, company_name:data.company_name, industry:'', address:data.address, phone:data.phone, email:data.email, logo:'', user_group:'staff', status:'Active' };
						usersCol.insertOne(document, function(err) {
							if(err) throw err;
							else{
								console.log("User inserted.");
								document = { _id: id, branch:data.branch, department:data.department, usergroup:data.usergroup, hierarchy:data.hierarchy };
								staffCol.insertOne(document, function(err) {
									if(err) throw err;
									else{
										db.close();
										console.log("Staff inserted.");
										req.session.signup_success = true;
										res.redirect('/signup/success');
									}
								});
							}
						});
					});
				});
			});
		});
    });
})
.post('/signup/customer', function(req, res) { //process signup for customer account
	var data = {};
	var form = new formidable.IncomingForm();
	form.parse(req)
	.on('file', function (name, file){
		if(file.name != ""){ //file upload
			var oldpath = file.path;
			var newpath = __dirname + '/uploads/' + file.name;
			fs.rename(oldpath, newpath, function (err) {
				if (err) throw err;
				console.log('File uploaded.');
			});
		}
		data[name] = file.name;
    })
	.on('field', (name, value) => {
		data[name] = value;
    })
	.on('aborted', () => {
		console.error('Request aborted by the user');
    })
    .on('error', (err) => {
		console.error('Error', err);
		throw err;
    })
    .on('end', () => {
		console.log(data);
		MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
			if (err) throw err;
			var dbo = db.db('deconds');
			var usersCol = dbo.collection('users');
			usersCol.find({}).sort({_id:-1}).limit(1).toArray(function(err, result) {
				if(err) throw err;
				if(result.length > 0){
					var id = result[0]._id + 1;
				}else{
					var id = 1;
				}
				var enPass = '';
				bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt){
					if(err) return next(err);
					bcrypt.hash(data.password, salt, function(err, hash){
						if(err) return next(err);
						enPass = hash;
						
						var document = { _id: id, username:data.username, password:enPass, first_name:data.first_name, last_name:data.last_name, gender:data.gender, dob:data.dob, company_name:'', industry:'', address:data.address, phone:data.phone, email:data.email, logo:'', user_group:'customer', status:'Active' };
						usersCol.insertOne(document, function(err) {
							if(err) throw err;
							else{
								console.log("User inserted.");
								req.session.signup_success = true;
								res.redirect('/signup/success');
							}
						});
					});
				});
			});
		});
    });
})
.post('/modify/:collection', urlencodedParser, function(req, res) {
	var data = req.body;
	MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
		if (err) throw err;
		var dbo = db.db('deconds');
		var objCol = dbo.collection(req.params.collection);

		if(data._id){ //edit
			var filter = { _id: parseInt(data._id) };
			if(req.params.collection == 'branch'){
				var document = { $set: {branch_name: data.name, branch_location: data.location} };
			}else if(req.params.collection == 'department'){
				var document = { $set: {department_name: data.name} };
			}else if(req.params.collection == 'usergroup'){
				var document = { $set: {usergroup_name: data.name} };
			}else if(req.params.collection == 'hierarchy'){
				var document = { $set: {hierarchy_name: data.name} };
			}else if(req.params.collection == 'staff'){
				var document = { $set: {branch: data.branch, department: data.department, usergroup: data.usergroup, hierarchy: data.hierarchy} };

				var userDocument = { $set: {first_name: data.first_name, last_name: data.last_name, gender: data.gender, dob: data.dob, email: data.email, phone: data.phone, entry_date: data.entry_date, status: data.status} };
						
				var userCol = dbo.collection('users');
				userCol.updateOne(filter, userDocument, function(err, res2) {
					if(!err){
						console.log("users updated.");
					}
				});
            }else if(req.params.collection == 'working_schedule'){
				var document = { $set: {day: parseInt(data.day), start_time: data.start_time, end_time: data.end_time} };
			}
			
			objCol.updateOne(filter, document, function(err, res2) {
				if(err){
					res.send({success: false});
				}else{
					console.log(req.params.collection + " updated.");
					res.send({success: true});
				}
				db.close();
			});
		}else{ //new
			objCol.find({}).sort({_id:-1}).limit(1).toArray(function(err, result) {
				if(err) throw err;
				if(result.length > 0){
					var id = result[0]._id + 1;
				}else{
					var id = 1;
				}
				if(req.params.collection == 'branch'){
					var document = { _id: id, company_id: req.session.user_id, branch_name: data.name, branch_location: data.location };
				}else if(req.params.collection == 'department'){
					var document = { _id: id, company_id: req.session.user_id, department_name: data.name };
				}else if(req.params.collection == 'usergroup'){
					var document = { _id: id, company_id: req.session.user_id, usergroup_name: data.name };
				}else if(req.params.collection == 'hierarchy'){
					var document = { _id: id, company_id: req.session.user_id, hierarchy_name: data.name };
				}else if(req.params.collection == 'staff'){
					var document = { _id: id, branch: data.branch, department: data.department, usergroup: data.usergroup, hierarchy: data.hierarchy };

					var enPass = '';
					bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt){
						if(err) return next(err);
						bcrypt.hash(data.password, salt, function(err, hash){
							if(err) return next(err);
							enPass = hash;

							var userDocument = { _id: id, company_id: req.session.user_id, username: data.username, password: enPass, first_name: data.first_name, last_name: data.last_name, gender: data.gender, dob: data.dob, company_name: req.session.company_name,  email: data.email, phone: data.phone, address: data.address, entry_date: data.entry_date, user_group: 'staff', status: data.status };

							var userCol = dbo.collection('users');
							userCol.insertOne(userDocument, function(err, res2) {
								if(!err){
									console.log("users inserted.");
								}
							});
						});
					});		
				}else if(req.params.collection == 'working_schedule'){
                    var document = { _id: id, staff_id: req.session.user_id, day: parseInt(data.day), start_time: data.start_time, end_time: data.end_time };
                }else if(req.params.collection == 'appointment_schedule'){
                    var document = { _id: id, staff_id: parseInt(data.staff_id), customer_id: req.session.user_id, date: data.date, time: data.time, remarks: data.remarks };
                }
				
				objCol.insertOne(document, function(err, res2) {
					if (err){
						res.send({success: false, err_msg: err});
					}else{
						console.log(req.params.collection + " inserted.");
						res.send({success: true});
					}
					db.close();
				});
			});
		}
	});
})
.post('/delete/:collection', urlencodedParser, function(req, res) {
	var data = req.body;
	MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
		if (err) throw err;
		var dbo = db.db('deconds');
		var objCol = dbo.collection(req.params.collection);

		if(data._id){
			var filter = { _id: parseInt(data._id) };
			objCol.deleteOne(filter, function(err, res2) {
				if (err){
					res.send({success: false});
				}else{
					console.log(req.params.collection + " deleted.");
					res.send({success: true});
				}
				db.close();
			});
		}else{
			res.send({success: false});
		}
	});
})

.use(function(req, res, next){
	res.render('error_404.ejs', {page: req.url, session: req.session});
});

app.listen(80);

function listCollection(collection, query, selectedField, sortBy, callback) {
	MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
		if (err) throw err;
		var dbo = db.db('deconds');
		var objCol = dbo.collection(collection);
		
		var sortStr = {};
		if(sortBy){
			sortStr[sortBy] = 1;
		}
		
		var fieldStr = {};
		if(selectedField){
			fieldStr[selectedField] = 1;
		}
		
		objCol.find(query, fieldStr).sort(sortStr).toArray(function(err, result) {
			if (err) throw err;
			db.close();
			callback(result);
		});
	});
}

function listMultiCollection(primaryCollection, secondaryCollection, localField, foreignField, alias, fieldSelection, search, sortBy, callback) {
	var sortStr = {};
	if(sortBy){
		sortStr[sortBy] = 1;
	}
	var searchStr = {};
	if(search){
		searchStr = search;
	}
	var fieldStr = {};
	if(fieldSelection){
		fieldStr = fieldSelection;
	}

	MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
		if (err) throw err;
		var dbo = db.db('deconds');
		var objCol = dbo.collection(primaryCollection);
		
		objCol.aggregate([{
			$lookup:
				{
					from: secondaryCollection,
					localField: localField,
					foreignField: foreignField,
					as: alias
				}
			},{
				$unwind: "$"+alias
			}, searchStr, fieldStr
		]).sort(sortStr).toArray(function(err, result) {
			if (err) throw err;
			db.close();
			callback(result);
		});
	});
}
