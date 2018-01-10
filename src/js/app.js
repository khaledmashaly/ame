'use strict';
import '../css/styles.less';
import $ from 'jquery';
import Raven from 'raven-js';
Raven.config('https://d581b40eda8a444a928b39d898380a05@sentry.io/212857').install();
import errorHandler from './modules/error-handler';
import * as storage from './modules/storage';
import prefs from './modules/preferences';
import forecast from './modules/forecast';

(function(){
/* main object containing app state */
let _ame = {
	el: {
		note: {
			main: $('.ame-note'),
			text: $('.ame-note-txt'),
			timeoutId: 0
		}
	},
	formatTemp: function(t) {
		return t + '\u00b0' + this.options.unit;
	},
	updateTemp: function() {
		this.el.main.temp.text(this.formatTemp(this.data.main.temp));
		_ame.updateOptions(); /* <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< here */
		this.el.hour.temp.each(function(i, el) {
			let t = _ame.data.hour[i].temp;
			$(el).text(_ame.formatTemp(t));
		});
		$.each(this.el.day.temp, function(key, val) {
			val.each(function(i, el) {
				let t = _ame.data.day[i].temp[key];
				$(el).text(_ame.formatTemp(t));
			});
		});
	},
	setTemp: function _ameSetTemp(t) {
		t = t - 273;
		return prefs.current.unit === 'C' ? Math.round(t) : _ame.toFahrenheit(t);
	},
	toCelsius: function _ameToCelsius(f) {
		return Math.round((5/9) * (f - 32));
	},
	toFahrenheit: function _ameToFahrenheit(c) {
		return Math.round((9/5) * c + 32);
	},
	toggleTemp: function _ameToggleTemp() {
		console.log('toggleTemp called');
		let u = 'fahrenheit';

		if (this.options.unit === 'C') {
			console.log('converting from celsius to fahrenheit');
			this.options.unit = 'F';
			this.el.main.temp.attr('data-label', 'switch to celsuis');
			this.data.main.temp = _ame.toFahrenheit(this.data.main.temp);
			$.each(this.data.hour, function(i, val) {
				val.temp = _ame.toFahrenheit(val.temp);
			});
			$.each(this.data.day, function(i, val) {
				val.temp.min = _ame.toFahrenheit(val.temp.min);
				val.temp.max = _ame.toFahrenheit(val.temp.max);
			});
			u = 'fahrenheit';
		}
		else if (this.options.unit === 'F') {
			console.log('converting from fahrenheit to celsius');
			this.options.unit = 'C';
			this.el.main.temp.attr('data-label', 'switch to fahrenheit');
			this.data.main.temp = _ame.toCelsius(this.data.main.temp);
			$.each(this.data.hour, function(i, val) {
				val.temp = _ame.toCelsius(val.temp);
			});
			$.each(this.data.day, function(i, val) {
				val.temp.min = _ame.toCelsius(val.temp.min);
				val.temp.max = _ame.toCelsius(val.temp.max);
			});
			u = 'celsuis';
		}
		this.updateTemp();
		this.el.options.updateUnit();
		prefs.save();
		localStorage.setItem('data', JSON.stringify(_ame.data));
		this.notify('<strong>changed default unit to ' + u + '</strong><br>preferences saved!');
	},
	switchUnits: function() {
		_ame.toggleTemp();
	},
	notify: function _ameNotify(msg) {
		const note = _ame.el.note;
		clearTimeout(note.timeoutId);
		note.main.hide();
		note.text.html(msg);
		note.main.fadeIn(250, function() {
			note.timeoutId = setTimeout(function() {
				note.main.fadeOut(250);
			}, 1500);
		});
	},
	locationError: function _ameLocationError(e) {
		let m = 'location error';
		switch (e.code) {
			case 1:
				m = 'user denied permision, please allow app to access your location or enter your location manually.';
				break;
			case 2:
				m = 'location is unavailable, make sure you\'re connected to the internet. if the problem presists, enter your location manually or try again later.';
				break;
			case 3:
				m = 'browser is taking too long to respond, please enter your location manually or try again later.';
				break;
		}
		errorHandler('error: ' + m, true);
	},
	updateOptions: function ameUpdateOptions() {

	},
	interface: {
		main: $('.ame-main'),
		location: $('.ame-locator'),
		locationButton: $('.ame-auto-loc'),
		state: 'location',
		orientation: 'unknown',
		switch: function _ameInterfaceSwitch() {
			if (_ame.interface.state === 'location') {
				_ame.interface.main.removeClass('hidden');
				_ame.interface.location.addClass('hidden');
				_ame.interface.state = 'main';
			}
			else {
				_ame.interface.location.removeClass('hidden');
				_ame.interface.main.addClass('hidden');
				_ame.interface.state = 'location';
				prefs.current.location = undefined;
				prefs.save();
			}
			console.log('switched to ' + _ame.interface.state + ' ui.');
		},
		orient: function _ameInterfaceOrient() {
			const bod = $('html');
			const h = $(window).height();
			const w = $('body').prop('clientWidth');
			const p = bod.hasClass('portrait');
			const l = bod.hasClass('landscape');
			if (h > w || w <= 768) {
				if (!p) bod.addClass('portrait');
				if (l) bod.removeClass('landscape');
				_ame.interface.orientation = 'portrait';
			}
			else {
				if (!l) bod.addClass('landscape');
				if (p) bod.removeClass('portrait');
				_ame.interface.orientation = 'landscape';
			}
		},
		togglePreferences: function _ameInterfaceTogglePreferences() {
			const orient = _ame.interface.orientation;
			if (orient === 'portrait') {
				$('.ame-pref-wrap').slideToggle(200);
			}
		},
		toggleContacts: function _ameInterfaceToggleContacts() {
			const orient = _ame.interface.orientation;
			if (orient === 'portrait') {
				$('.ame-contacts').slideToggle(200);
			}
		}
	},
	manual: {
		form: $('.ame-manual'),
		label: $('.ame-manual label'),
		input: $('input[name=location]'),
		list: $('.ame-loc-match'),
		loader: $('.ame-manual-loader'),
		country: [],
		selectedCountry: 'none',
		city: [],
		initialSetup: function _ameManualInitialSetup() {
			_ame.manual.list.on('mouseenter', function () {
				console.log('hovering over this thing');
				_ame.manual.input.blur();
			})
			.on('mouseleave', function () {
				console.log('getting out of this thing');
				_ame.manual.input.focus();
			});
		},
		setup: function _ameManualSetup() {
			// set loader width to equal label + input
			console.log(_ame.manual.form.outerWidth());
			_ame.manual.loader.width(_ame.manual.form.outerWidth());
			_ame.manual.hide(); // hidden by default
			_ame.manual.list.hide(); // hide the list initially
		},
		listSetup: function _ameManualListSetup() {
			//const w = $('body').width();
			const el = _ame.manual.list;
			let elWidth, elLeft;
			const elHeight = Math.floor($('html').outerHeight() - _ame.manual.input.offset().top - _ame.manual.input.outerHeight());
			if ($('html').hasClass('landscape')) {
				elWidth = Math.floor(_ame.manual.input.outerWidth());
				elLeft = Math.floor( _ame.manual.input.offset().left - _ame.manual.form.offset().left - parseInt(_ame.manual.form.css('padding-left'), 10) );
				console.log(elHeight);
			}
			else {
				// const form = _ame.manual.form;
				elWidth = _ame.manual.input.outerWidth();
				elLeft = 0 /* parseInt(form.css('padding-left'), 10) */;
			}
			el.css({
				width: elWidth,
				height: elHeight,
				left: elLeft
			});
			el.html('');
		},
		show: function _ameManualShow() {
			_ame.manual.form.show();
			_ame.manual.loader.hide();
		},
		hide: function _ameManualHide() {
			_ame.manual.form.hide();
			_ame.manual.loader.show();
		},
		loadCountry: function _ameManualLoadCountry() {
			$.getJSON('/data/country.json', function (data) {
				_ame.manual.country = data;
				console.log('load country success', _ame.manual.country);
				_ame.manual.input.on('keyup change', _ame.manual.country, _ame.manual.populate);
				_ame.manual.show();
				_ame.manual.listSetup();
			})
			.fail(function (err) {
				errorHandler('loading country list error' + err, true);
			});
		},
		loadCity: function _ameManualLoadCity() {
			console.log('event fireeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeed!');
			_ame.manual.hide();
			const el = $(this);
			const id = el.attr('data-id');
			_ame.manual.selectedCountry = el.text();
			console.log('selected country: ' + _ame.manual.selectedCountry);
			$.ajax('/cities', {
				type: 'POST',
				data: 'id=' + id,
				success: function _ameManualLoadCitySuccess(data) {
					_ame.manual.city = data;
					console.log('success for post request');
					console.log(_ame.manual.city);
					_ame.manual.input.val('').attr('placeholder', 'enter city, state or region');
					_ame.manual.label.text(_ame.manual.selectedCountry + ':');
					_ame.manual.setup();
					_ame.manual.list.off('click', 'a', _ame.manual.loadCity)
									.on('click', 'a', fromInput);
					_ame.manual.input	.off('keyup change')
										.on('keyup change', _ame.manual.city, _ame.manual.populate);
					_ame.manual.show();
					_ame.manual.listSetup();
					_ame.manual.input.focus();
				},
				error  : function _ameManualLoadCityError(jqXHR, status, error) {
					errorHandler('load city error\njqXHR: '+ jqXHR +'\nstatus: '+ status +'\nerror: '+ error, true);
				}
			});
		},
		filter: function _ameManualFilter(key, data) {
			return data.filter(function(place) {
				const regex = new RegExp(key, 'gi');
				return place[0].match(regex);
			});
		},
		populate: function _ameManualPopulate(ev) {
			const data = ev.data;
			const key = $(this).val();
			if (key) {
				let match = _ame.manual.filter(key, data);
				let matchHtml = $.map(match, place => {
					// const re = new RegExp(key, 'gi');
					// const hl = place[0].replace(re, `<span class="hl">${key}</span>`);
					return `<li><a data-id="${place[1]}">${place[0]}</a>`;
				})/*.slice(0, 50)*/;
				if (matchHtml.length === 0) {
					const noMatch = `<li>no match found!</li>`;
					_ame.manual.list.html(noMatch);
				}
				else {
					_ame.manual.list.html(matchHtml);
				}
				_ame.manual.list.show();
			}
			else {
				_ame.manual.list.hide();
			}
		}
	}
};

const getLocation = function(e) {
	e.preventDefault();
	console.log('getLocation called');

	if (navigator.geolocation) {
		console.log('getLocation supported');
		let locationOptions = {
			enableHighAccuracy: true,
			timeout: 30000,
			maximumAge: 0
		};
		navigator.geolocation.getCurrentPosition(getWeather, _ame.locationError, locationOptions);
	}
	else {
		errorHandler('getLocation not supported');
	}
};

const checkDifference = function() {
	let mnts = 10;
	let lastCall = storage.load('lastCall');

	if (storage.load('forecast') && lastCall) {
		const time = Date.now();
		lastCall = Number.parseInt(lastCall, 10);
		mnts = (time - lastCall) / 60000;
	}

	console.log(`last api call was ${mnts} minutes ago`);
	return (mnts >= 10) ? true : false;
};

const fromInput = function(event) {
	event.preventDefault();
	const loc = $(this).attr('data-id');
	console.log('location: ' + loc);
	getWeather(loc, true);
	_ame.manual.input.val('');
	_ame.manual.list.hide();
};

const getWeather = (location, noGeo) => {
	if (noGeo === undefined) { /* location is a geolocation object */
		const lat = location.coords.latitude;
		const lon = location.coords.longitude;
		location = {
			loc: JSON.stringify( {lat, lon} )
		};
	}
	else if (noGeo === true) {
		const id = location;
		location = {
			loc: JSON.stringify({id})
		};
	}

	$.ajax({
		url: '/api',
		method: 'POST',
		data: location,
		success: (res, textStatus) => {
			if (textStatus === 'success') {
				forecast.data = res; // save response to forecast
				forecast.update(); // update forecast panels
				_ame.interface.switch(); // switch to forecast view

				prefs.updateLocation(res.id); // update location id and save locally
				forecast.save(); // save new forecast data locally
				storage.save('lastCall', Date.now());	// update lastCall
			}
			else {
				errorHandler('server responded with an error', true);
			}
		},
		error: (jqxhr, textStatus, error) => {
			const err = textStatus + ', ' + error;
			errorHandler('Request Failed: ' + err, true);
		}
	});
};

$(function() {
	_ame.interface.orient();
	_ame.manual.initialSetup();
	_ame.manual.setup();
	_ame.manual.loadCountry();

	if ( prefs.load() ) {
		const loc = prefs.current.location;
		if (typeof loc === 'number') { // double check prefs were loaded from localstorage
			console.log('using locally saved location: ' + loc);
			if ( checkDifference() ) {
				getWeather(loc, true);
			}
			else {
				console.log('loading weather from localStorage');
				if ( forecast.load() ) {
					forecast.update();
				_ame.interface.switch();
			}
				else { // get new data from server, because an error occured while loading data from localStorage
					getWeather(loc, true);
				}
			}
		}
	}

	/* Event Listeners
	========================================= */
	/* core functionality */
		_ame.interface.locationButton.on('click', getLocation);

	/* manual location input start */
		_ame.manual.input.on('keypress', function(e) {
			if (e.keyCode === 13) e.preventDefault();
		});
		_ame.manual.list.on('click', 'a', _ame.manual.loadCity);
	/* manual location input end */

	/* options start */
		forecast.main.temp.on('click', _ame.switchUnits);
		prefs.unitElement.on('click', _ame.switchUnits);
		prefs.locationElement.on('click', _ame.interface.switch);
	/* options end */

	/* ui start */
		$(window).on('resize', _ame.interface.orient);
		$('.ame-pref-toggle').on('click', _ame.interface.togglePreferences);
		$('.ame-contacts-toggle').on('click', _ame.interface.toggleContacts);
	/* ui end */

	/* const locito = '&id=361058';
	getWeather(locito, true); */
});

}());