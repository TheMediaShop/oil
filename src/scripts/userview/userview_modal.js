import '../../styles/modal.scss';
import '../../styles/cpc.scss';
import { sendEventToHostSite } from '../core/core_utils.js';
import { removeSubscriberCookies } from '../core/core_cookies.js';
import { convertPrivacySettingsToCookieValue, getSoiPrivacy } from './userview_cookies.js';
import {
  PRIVACY_MINIMUM_TRACKING,
  PRIVACY_FUNCTIONAL_TRACKING,
  PRIVACY_FULL_TRACKING,
  EVENT_NAME_BACK_TO_MAIN,
  EVENT_NAME_ADVANCED_SETTINGS,
  EVENT_NAME_SOI_OPT_IN,
  EVENT_NAME_POI_OPT_IN,
  EVENT_NAME_AS_SELECTED_MINIMUM,
  EVENT_NAME_AS_SELECTED_FUNCTIONAL,
  EVENT_NAME_AS_SELECTED_FULL,
  EVENT_NAME_COMPANY_LIST,
  EVENT_NAME_THIRD_PARTY_LIST,
  EVENT_NAME_TIMEOUT
} from '../core/core_constants.js';
import { oilOptIn, oilPowerOptIn } from './userview_optin.js';
import { deActivatePowerOptIn } from '../core/core_poi.js';
import { oilDefaultTemplate } from './view/oil.default.js';
import { oilNoCookiesTemplate } from './view/oil.no.cookies.js';
import { oilAdvancedSettingsTemplate } from './view/oil.advanced.settings.js';
import { logInfo, logError } from '../core/core_log.js';
import { isPersistMinimumTracking, getTimeOutValue, getTheme } from './userview_config.js';
import { isSubscriberSetCookieActive } from '../core/core_config.js';
import { getPoiGroupName, isPoiActive } from '../core/core_config';
import { attachCpcHandlers } from './view/oil.advanced.settings';


// Initialize our Oil wrapper and save it ...

export const oilWrapper = defineOilWrapper;
export let hasRunningTimeout;

function startTimeOut() {
  if (!hasRunningTimeout && getTimeOutValue() > 0) {
    logInfo('OIL will auto-hide in', getTimeOutValue(), 'seconds.');
    hasRunningTimeout = setTimeout(function () {
      removeOilWrapperFromDOM();
      sendEventToHostSite(EVENT_NAME_TIMEOUT);
    }, getTimeOutValue() * 1000);
  }
}

export function stopTimeOut() {
  if (hasRunningTimeout) {
    clearTimeout(hasRunningTimeout);
    hasRunningTimeout = undefined;
  }
}

/**
 * Utility function for forEach safety
 *
 * @param array
 * @param callback
 * @param scope
 */
export function forEach(array, callback, scope) {
  for (let i = 0; i < array.length; i++) {
    callback.call(scope, array[i]);
  }
}

/**
 * Oil Main Render Function:
 */
export function renderOil(props) {
  if (shouldRenderOilLayer(props)) {
    if (props.noCookie) {
      renderOilContentToWrapper(oilNoCookiesTemplate());
    } else if (props.advancedSettings) {
      renderOilContentToWrapper(oilAdvancedSettingsTemplate());
    } else {
      startTimeOut();
      renderOilContentToWrapper(oilDefaultTemplate());
    }
  } else {
    removeOilWrapperFromDOM();
  }
}

/**
 * Helper that determines if Oil layer is shown or not...
 * Oil layer is not rendered eg. if user opted in
 * @param {*} props
 */
function shouldRenderOilLayer(props) {
  return props.optIn !== true;
}

function interpretSliderValue(value) {
  switch (value) {
    default:
    case '0.00':
      logInfo('Essential Cookies selected');
      return PRIVACY_MINIMUM_TRACKING;
    case '1.00':
      logInfo('Functional Cookies selected');
      return PRIVACY_FUNCTIONAL_TRACKING;
    case '2.00':
      logInfo('Full Cookies selected');
      return PRIVACY_FULL_TRACKING;
  }
}

// FIXME
export function oilShowPreferenceCenter(preset = PRIVACY_MINIMUM_TRACKING) {
  let wrapper = document.querySelector('.as-oil');
  let entryNode = document.querySelector('#oil-preference-center');
  if (wrapper) {
    renderOil({advancedSettings: true});
  } else if (entryNode) {
    // FIXME
    entryNode.innerHTML = advancedSettingsSnippet();
  } else {
    logError('No wrapper for the CPC with the id #oil-preference-center was found.');
    return;
  }

  // we take the soi privacy for now as start value, since this should always represent the poi privacy if it was set
  // we need a product decision how to handle this if poi and soi values can differ
  let currentPrivacySetting = preset;
  let soiPrivacy = getSoiPrivacy();
  if (soiPrivacy) {
    currentPrivacySetting = soiPrivacy.oiid;
  }
}

function oilShowCompanyList() {
  System.import(`../poi-list/lists/poi-info_${getPoiGroupName()}.js`)
    .then(poiList => {
      renderOilContentToWrapper(poiList.oilGroupListTemplate(poiList.companyList));
    })
    .catch((e) => {
      logError(`POI 'group ${getPoiGroupName()}' could not be loaded.`, e);
    });

}

function oilShowThirdPartyList() {
  System.import(`../poi-list/lists/poi-info_${getPoiGroupName()}.js`)
    .then(poiList => {
      renderOilContentToWrapper(poiList.oilThirdPartyListTemplate(poiList.thirdPartyList));
    })
    .catch((e) => {
      logError(`POI 'group ${getPoiGroupName()}' could not be loaded.`, e);
    });
}

/**
 * Define Oil Wrapper DOM Node
 * @return object DOM element
 */
function defineOilWrapper() {
  let oilWrapper = document.createElement('div');
  // Set some attributes as CSS classes and attributes for testing
  oilWrapper.setAttribute('class', `as-oil ${getTheme()}`);
  oilWrapper.setAttribute('data-qa', 'oil-Layer');
  return oilWrapper;
}

/**
 * Define Content of our Oil Wrapper
 * Sets HTML based on props ...
 */
function renderOilContentToWrapper(content) {
  let wrapper = oilWrapper();
  wrapper.innerHTML = content;
  injectOilWrapperInDOM(wrapper);
}

function removeOilWrapperFromDOM() {
  let domNodes = getOilDOMNodes();
  // For every render cycle our OIL main DOM node gets removed, in case it already exists in DOM
  if (domNodes.oilWrapper) {
    forEach(domNodes.oilWrapper, function (domNode) {
      domNode.parentElement.removeChild(domNode);
    });
  }
}

function injectOilWrapperInDOM(wrapper) {
  removeOilWrapperFromDOM();

  // Insert OIL into DOM
  document.body.insertBefore(wrapper, document.body.firstElementChild);
  addOilHandlers(getOilDOMNodes());
}

/**
 * Small Utility Function to retrieve our Oil Wrapper and Action Elements,
 * like Buttons ...
 * @return data object which contains various OIL DOM nodes
 */
function getOilDOMNodes() {
  return {
    oilWrapper: document.querySelectorAll('.as-oil'),
    btnOptIn: document.querySelectorAll('.as-oil .as-js-optin'),
    btnPoiOptIn: document.querySelectorAll('.as-oil .as-js-optin-poi'),
    btnOptLater: document.querySelectorAll('.as-oil .as-js-optlater'),
    companyList: document.querySelectorAll('.as-oil .as-js-companyList'),
    thirdPartyList: document.querySelectorAll('.as-oil .as-js-thirdPartyList'),
    btnAdvancedSettings: document.querySelectorAll('.as-oil .as-js-advanced-settings'),
    btnBack: document.querySelectorAll('.as-oil .as-js-oilback')
  }
}

function getRangeSliderValue() {
  let rangeSlider = document.getElementById('as-slider-range');
  if (rangeSlider) {
    return interpretSliderValue(rangeSlider.noUiSlider.get());
  }
  return PRIVACY_FULL_TRACKING;
}

function handleBackToMainDialog() {
  logInfo('Handling Back Button');
  stopTimeOut();
  renderOil({});
  sendEventToHostSite(EVENT_NAME_BACK_TO_MAIN);
}

function handleAdvancedSettings() {
  logInfo('Handling Show Advanced Settings');
  stopTimeOut();
  oilShowPreferenceCenter(PRIVACY_MINIMUM_TRACKING);
  sendEventToHostSite(EVENT_NAME_ADVANCED_SETTINGS);
}

function handleCompanyList() {
  logInfo('Handling Show Company List');
  stopTimeOut();
  oilShowCompanyList();
  sendEventToHostSite(EVENT_NAME_COMPANY_LIST);
}

function handleThirdPartyList() {
  logInfo('Handling Show Third Party List');
  stopTimeOut();
  oilShowThirdPartyList();
  sendEventToHostSite(EVENT_NAME_THIRD_PARTY_LIST);
}

function trackPrivacySetting(privacySetting) {
  switch (privacySetting) {
    default:
    case PRIVACY_MINIMUM_TRACKING:
      sendEventToHostSite(EVENT_NAME_AS_SELECTED_MINIMUM);
      break;
    case PRIVACY_FUNCTIONAL_TRACKING:
      sendEventToHostSite(EVENT_NAME_AS_SELECTED_FUNCTIONAL);
      break;
    case PRIVACY_FULL_TRACKING:
      sendEventToHostSite(EVENT_NAME_AS_SELECTED_FULL);
      break;
  }
}

export function handleOptIn() {
  if (isPoiActive()) {
    handlePoiOptIn();
  } else {
    handleSoiOptIn();
  }
}

export function handleSoiOptIn() {
  let privacySetting = getRangeSliderValue();
  logInfo('Handling SOI with settings: ', privacySetting);
  trackPrivacySetting(privacySetting);
  if (privacySetting !== PRIVACY_MINIMUM_TRACKING || isPersistMinimumTracking()) {
    oilOptIn(convertPrivacySettingsToCookieValue(privacySetting)).then((cookieOptIn) => {
      renderOil({optIn: cookieOptIn});
      sendEventToHostSite(EVENT_NAME_SOI_OPT_IN);
    });
  } else {
    removeSubscriberCookies();
  }
}

export function handlePoiOptIn() {
  let privacySetting = getRangeSliderValue();
  logInfo('Handling POI with settings: ', privacySetting);
  trackPrivacySetting(privacySetting);
  if (privacySetting !== PRIVACY_MINIMUM_TRACKING || isPersistMinimumTracking()) {
    oilPowerOptIn(convertPrivacySettingsToCookieValue(privacySetting), !isSubscriberSetCookieActive()).then(() => {
      renderOil({optIn: true});
      if (isPoiActive()) {
        sendEventToHostSite(EVENT_NAME_POI_OPT_IN);
      }
    });
  } else {
    removeSubscriberCookies();
    deActivatePowerOptIn();
  }
}

/**
 * adds a listener to all dom nodes in this list
 * @param listOfDoms
 * @param listener
 */
function addEventListenersToDOMList(listOfDoms, listener) {
  if (listOfDoms) {
    forEach(listOfDoms, function (domNode) {
      domNode && domNode.addEventListener('click', listener, false);
    });
  }
}

/**
 * Add and Remove Handlers to Oil Action Elements
 */
function addOilHandlers(nodes) {
  addEventListenersToDOMList(nodes.btnOptIn, handleOptIn);
  addEventListenersToDOMList(nodes.btnAdvancedSettings, handleAdvancedSettings);
  addEventListenersToDOMList(nodes.btnBack, handleBackToMainDialog);
  addEventListenersToDOMList(nodes.companyList, handleCompanyList);
  addEventListenersToDOMList(nodes.thirdPartyList, handleThirdPartyList);
  attachCpcHandlers();
}
