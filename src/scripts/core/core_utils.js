import { logInfo } from './core_log';
import { OIL_GLOBAL_OBJECT_NAME } from './core_constants';
import { getLocale } from './core_config';

/**
 * Check if environment is set to production
 * @returns {boolean} true if environment is production, otherwise false
 * @function
 */
export function isProd() {
  switch (process.env.NODE_ENV) {
    case 'production':
    case 'prod':
      return true;
    default:
      return false;
  }
}

/**
 * Check if environment is set to development
 * @returns {boolean} true if environment is development, otherwise false
 * @function
 */
export function isDev() {
  switch (process.env.NODE_ENV) {
    case 'development':
    case 'dev':
      return true;
    default:
      return false;
  }
}

/**
 * Robust util function to get the origin of the current window, even if window.location.origin is undefined
 * @returns string origin of current window
 */
export function getOrigin() {
  if (!window.location.origin) {
    window.location.origin = window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : '');
  }
  return window.location.origin
}

/**
 * Sent event to host site
 * @param eventName - event payload to sent
 * @function
 */
export function sendEventToHostSite(eventName) {
  window.postMessage(eventName, getOrigin());
  window.AS_OIL.eventCollection = window.AS_OIL.eventCollection || [];
  window.AS_OIL.eventCollection.push(
    {
      name: eventName,
      timestamp: new Date().getTime()
    }
  );
  logInfo(`Sent postmessage event: ${eventName}`);
}

// Create IE + others compatible event handler
let eventMethod = window.addEventListener ? 'addEventListener' : 'attachEvent';
let eventRemoveMethod = window.removeEventListener ? 'removeEventListener' : 'removeEvent';
let eventer = window[eventMethod];
let eventerRemove = window[eventRemoveMethod];
let messageEvent = eventMethod === 'attachEvent' ? 'onmessage' : 'message';
let messageRemoveEvent = eventRemoveMethod === 'removeEvent' ? 'onmessage' : 'message';

/**
 * Remove Message Listener
 * @param {*} callback
 */
export function removeMessageListener(callback) {
  eventerRemove(messageRemoveEvent, callback, false);
}

/**
 * Register Message Listener
 * @param {*} callback
 */
export function registerMessageListener(callback) {
  eventer(messageEvent, callback, false);
}

/**
 * Mockable OilVersion Object for getting the current software version in code, set at compile time
 * @type {{get: (())}}
 */
export let OilVersion = {
  get: () => {
    return `${process.env.LATEST_RELEASE_VERSION}-${process.env.OIL_VERSION}`;
  },
  getLatestReleaseVersion: () => {
    return `${process.env.LATEST_RELEASE_VERSION}`;
  }
};

/**
 * Returns the current client timestamp
 * @returns {number}
 */
export function getClientTimestamp() {
  if (!Date.now) {
    Date.now = function () {
      return new Date().getTime();
    }
  }
  return Date.now();
}

/**
 *
 * Checks if an array contains obj.
 * Use this instead of includes.
 *
 * @param array
 * @param obj
 * @returns {boolean}
 */
export function arrayContains(array, obj) {
  let arrayLength = array.length;
  for (let i = 0; i < arrayLength; i++) {
    if (array[i] === obj) {
      return true;
    }
  }
  return false;
}

export function arrayContainsArray(array, checkedArray) {
  if (!array || !checkedArray) {
    return false;
  }
  let elementCounterMap = {};

  for (let i = 0; i < array.length; i++) {
    if (!elementCounterMap[array[i]]) {
      elementCounterMap[array[i]] = 0;
    }
    elementCounterMap[array[i]]++;
  }
  for (let i = 0; i < checkedArray.length; i++) {
    if (!elementCounterMap[checkedArray[i]] || --elementCounterMap[checkedArray[i]] < 0) {
      return false;
    }
  }
  return true;
}

/**
 * Sets a global object within OIL namespace.
 *
 * @param name
 * @param object
 */
export function setGlobalOilObject(name, object) {
  if (!window[OIL_GLOBAL_OBJECT_NAME]) {
    window[OIL_GLOBAL_OBJECT_NAME] = {};
  }
  window[OIL_GLOBAL_OBJECT_NAME][name] = object;
}

/**
 * Gets a global object within OIL namespace.
 *
 * @param name
 * @returns {*}
 */
export function getGlobalOilObject(name) {
  if (!window[OIL_GLOBAL_OBJECT_NAME]) {
    return undefined;
  }
  return window[OIL_GLOBAL_OBJECT_NAME][name];
}

/**
 * Gets the version of current locale (variant) or 0 if there is none.
 *
 * @returns {number}
 */
export function getLocaleVariantVersion() {
  let locale = getLocale();
  return (locale && locale.version) ? locale.version : 0;
}

/**
 * Gets the command collection from window object.
 */
export function getCommandCollection() {
  return window.__cmp ? window.__cmp.commandCollection : undefined;
}

/**
 * Fetches JSON data from web service addressed by given url.
 *
 * @param url the url of the web service.
 * @returns {Promise<any>}
 */
export function fetchJsonData(url) {
  return new Promise((resolve, reject) => {
    let request = new XMLHttpRequest();
    logInfo(`Fetching data from url: ${url}`);
    request.open('GET', url);
    request.onreadystatechange = function () {
      if (request.readyState === this.DONE) {
        if (request.status === 200) {
          resolve(JSON.parse(request.responseText));
        } else {
          let error;
          if (request.status !== 0) {
            let errorResponse = JSON.parse(request.responseText);
            error = new Error(errorResponse.errorMessage);
          } else {
            error = new Error(`Connection error occurred while fetching JSON data from ${url}!`);
          }
          reject(error);
        }
      }
    };
    request.send();
  });
}

export function isObject(o) {
  return o instanceof Object && o.constructor === Object;
}
