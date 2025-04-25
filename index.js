/* jshint node: true */
'use strict';

// modified in purpose,
// but based on https://gist.github.com/novaugust/9d0133588fc29844afaf
// and https://github.com/heyjinkim/ember-cli-index-fragment/blob/master/index.js
var path = require('path');
var fs = require('fs');
var glob = require('glob');
var prefixReplacement = 'PREFIX_PATTERN';

var util = require('util');

function concoctFrom(input, toBeReplaced, replacement) {
  // escape necessary characters for proper eval later
  var concoction = input; // = input.replace(/\\/g, '\\').replace(/"/g, '\"');

  // replace modulePrefix with placeholder pattern
  var re = new RegExp(toBeReplaced, 'g');
  concoction = concoction.replace(re, replacement);

  return concoction;
}

module.exports = {
  name: 'ember-cli-make-concoction',
  
  included: function(app) {
    this._super.included.apply(this, arguments);
    
    // Store config options from ember-cli-build.js
    this.addonOptions = app.options['ember-cli-make-concoction'] || {};
    
    // Get the replacement pattern from options, or use the default
    if (this.addonOptions.replacementPattern) {
      prefixReplacement = this.addonOptions.replacementPattern;
    }
  },
  
  postBuild: function(result) {
    // Check if enabled is set to false in the config
    if (this.addonOptions.enabled === false) {
      return;
    }
    
    // only do this step if production build or explicitly enabled
    if (process.env.EMBER_ENV === 'production' || this.addonOptions.enabled === true) {
      try {
        // based on convention is that root dir name is modulePrefix
        var modulePrefix = this.project.config(process.env.EMBER_ENV).modulePrefix;
        var buildDirPath = result.directory;
        var assetsDirPath = path.join(buildDirPath, '/assets/');
        
        console.log('\nSearching for app code in: ' + assetsDirPath);
        
        // Try different patterns to find the app code
        var patterns = [
          // Original pattern
          path.join(assetsDirPath, modulePrefix + '-*.js'),
          // Embroider chunks pattern
          path.join(assetsDirPath, 'chunk.*.js'),
          // Embroider main app pattern for browser variant
          path.join(assetsDirPath, 'browser.*.js'),
          // Generic fallback pattern for any js file
          path.join(assetsDirPath, '*.js')
        ];
        
        var inputFile = null;
        
        // Try each pattern until we find a matching file
        for (var i = 0; i < patterns.length; i++) {
          var pattern = patterns[i];
          console.log('Trying pattern: ' + pattern);
          
          var matches = glob.sync(pattern);
          
          if (matches && matches.length > 0) {
            // If we have multiple matches, try to find the one that's most likely the main app code
            // by checking for modulePrefix in the content
            for (var j = 0; j < matches.length; j++) {
              var currentFile = matches[j];
              var content = fs.readFileSync(currentFile, {encoding: 'utf8'});
              
              if (content.indexOf(modulePrefix) !== -1) {
                inputFile = currentFile;
                console.log('Found app code in: ' + inputFile);
                break;
              }
            }
            
            // If we didn't find a file with modulePrefix, just use the first match
            if (!inputFile && matches.length > 0) {
              inputFile = matches[0];
              console.log('Using first matching file: ' + inputFile);
            }
            
            if (inputFile) {
              break;
            }
          }
        }
        
        if (!inputFile) {
          throw new Error('Could not find app code in assets directory');
        }
        
        var appCode = fs.readFileSync(inputFile, {encoding: 'utf8'});
        
        // Save to build directory instead of project root
        var outputFilePath = path.join(buildDirPath, modulePrefix + '-concoction.txt');
        var concoction = concoctFrom(appCode, modulePrefix, prefixReplacement);
        fs.writeFileSync(outputFilePath, concoction);
        
        console.log('\nSuccessfully made ' + modulePrefix + ' concoction as ' + outputFilePath);
      } catch (error) {
        console.error('\nError creating concoction:', error);
      }
    }
  }
};
