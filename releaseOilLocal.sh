#!/usr/bin/env bash

### Helper functions

function checkEnvironment {
  variable=$1
  if [[ "${!variable}" = "" ]];
  then
    echo "Error: Necessary environment variable undefined! Please define '$variable'!";
    exit 1
  fi
}

### Configuration
PACKAGE_VERSION=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[\",]//g' | tr -d '[[:space:]]')

### Main

echo "\n### Checking environment"
checkEnvironment "RELEASE_NUMBER"

echo "### Validating release number"
if [[ "${RELEASE_NUMBER}" != "${PACKAGE_VERSION}" ]];
then
  echo "Error: given release number does not match version in package.json!"
  exit 1
fi

echo "### Building release" $PACKAGE_VERSION$SNAPSHOT
export SNAPSHOT="RELEASE";npm run build:release || exit 1


echo "### Copying release to release directory"
mkdir release/$PACKAGE_VERSION
cp dist/*.RELEASE.*.js release/$PACKAGE_VERSION/
cp -r dist/docs release/$PACKAGE_VERSION/


echo "### Copying stats.json to release directory"
cp dist/stats.json release/$PACKAGE_VERSION/


echo "### Copying hub.html to release directory and versioning it"
cp src/hub.html release/$PACKAGE_VERSION/
HUB_HTML=$(cat release/$PACKAGE_VERSION/hub.html)
HUB_JS=$(cat release/$PACKAGE_VERSION/hub.RELEASE.min.js)
echo "${HUB_HTML/<!--REPLACEME-->/$HUB_JS}" > release/$PACKAGE_VERSION/hub.html
cp release/$PACKAGE_VERSION/hub.html dist/latest/hub.html


echo "### Copying and versioning poi-list to release directory"
cp -r dist/poi-lists release/$PACKAGE_VERSION/
mkdir dist/latest/poi-lists
cp dist/poi-lists/default.json dist/latest/poi-lists/default.json


echo "### Creating release for npmjs.com"
if [[ -d "release/current" ]];
then
  rm -rf release/current
fi
cp -r release/$PACKAGE_VERSION release/current
rm -rf release/current/docs release/current/poi-lists release/current/stats.json
