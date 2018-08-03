(function(global) {
  'use strict';

  /**
   * This is a manager for our resize handlers. You can add a callback, disable
   * all resize handlers, and re-enable handlers after they have been disabled.
   *
   * optimizedResize is adapted from Mozilla code:
   * https://developer.mozilla.org/en-US/docs/Web/Events/resize
   */
  var optimizedResize = (function() {
    var callbacks = [];
    var running = false;

    // fired on resize event
    function resize() {
      if (!running) {
        running = true;
        if (window.requestAnimationFrame) {
          window.requestAnimationFrame(runCallbacks);
        } else {
          setTimeout(runCallbacks, 66);
        }
      }
    }

    // run the actual callbacks
    function runCallbacks() {
      callbacks.forEach(function(callback) {
        callback();
      });

      running = false;
    }

    return {
      /**
       * Add a callback to be run on resize.
       *
       * @param {function} callback - the callback to run on resize.
       */
      add: function(callback) {
        if (!callbacks.length) {
          window.addEventListener('resize', resize);
        }

        callbacks.push(callback);
      },

      /**
       * Disables all resize handlers.
       */
      disable: function() {
        window.removeEventListener('resize', resize);
      },

      /**
       * Enables all resize handlers, if they were disabled.
       */
      reEnable: function() {
        window.addEventListener('resize', resize);
      },
    };
  }());

  /**
   * Inject CSS needed to make the grid work in the <head></head>.
   *
   * @param {string} classPrefix - the prefix associated with this library that
   *                               should be prepended to classnames.
   * @param {string} containerId - ID of the container for the images.
   */
  function _injectStyle(containerId, classPrefix, transitionSpeed, groupTitleHeight) {

    var css = (
      '#' + containerId + ' {' +
      '  position: relative;' +
      '}' +
      '.' + classPrefix + '-figure {' +
      '  background-color: #D5D5D5;' +
      '  overflow: hidden;' +
      '  left: 0;' +
      '  position: absolute;' +
      '  top: 0;' +
      '  margin: 0;' +
      '}' +
      '.' + classPrefix + '-figure-title {' +
      '  background-color: white;' +
      '  width: 100%;' +
      '}' +
      '.' + classPrefix + '-figure h1 {' +
      '  font-size: 21px;' +
      '  margin: 0 15px;' +
      '  line-height: ' + groupTitleHeight + 'px;' +
      '  color: #4CAF50;' +
      '  text-transform: uppercase;' +
      '  font-family: keepcalm, "Helvetica Neue", Helvetica, Arial, sans-serif;' +
      '  background-color: transparent;' +
      '}' +
      '.' + classPrefix + '-figure img {' +
      '  left: 0;' +
      '  position: absolute;' +
      '  top: 0;' +
      '  height: 100%;' +
      '  width: 100%;' +
      '  opacity: 0;' +
      '  transition: ' + (transitionSpeed / 1000) + 's ease opacity;' +
      '  -webkit-transition: ' + (transitionSpeed / 1000) + 's ease opacity;' +
      '}' +
      '.' + classPrefix + '-figure img.' + classPrefix + '-thumbnail {' +
      '  -webkit-filter: blur(30px);' +
      '  filter: blur(30px);' +
      '  left: auto;' +
      '  position: relative;' +
      '  width: auto;' +
      '}' +
      '.' + classPrefix + '-figure img.' + classPrefix + '-loaded {' +
      '  opacity: 1;' +
      '}'
    );

    var head = document.head || document.getElementsByTagName("head")[0];
    var style = document.createElement("style");

    style.type = "text/css";
    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }

    head.appendChild(style);
  }


  function _extend(obj1, obj2) {
    for (var i in obj2) {
      if (obj2.hasOwnProperty(i)) {
        obj1[i] = obj2[i];
      }
    }
  }


  /**
   * Load image with XMLHttpRequest
   * then get base64 encoded data with FileReader
   * and call success calback
   * If xhr status is not 200 then call error calback
  **/
  function _loadImg(url, success, error) {
    var
      progressiveImage = this,
      xhr              = new XMLHttpRequest();

    xhr.onreadystatechange = function() {
      if(xhr.readyState == 4 && xhr.status == 200) {
        var reader = new FileReader();
        reader.onloadend = function() {
          success.call(progressiveImage, reader.result);
        };
        reader.readAsDataURL(xhr.response);
      } else if(xhr.readyState == 4 && xhr.status !== 200) {
        error.call(progressiveImage, xhr.status);
      }
    };
    xhr.open('GET', url);
    xhr.responseType = 'blob';
    xhr.send();
  }


  function Pig(imageData, options) {
    // Global State
    this.inRAF = false;
    this.isTransitioning = false;
    this.minAspectRatioRequiresTransition = false;
    this.minAspectRatio = null;
    this.latestYOffset = 0;
    this.lastScrollElementWidth = window.innerWidth;
    this.scrollDirection = 'down';

    // List of images that are loading or completely loaded on screen.
    this.visibleImages = [];

    // These are the default settings, which may be overridden.
    this.settings = {
      containerId: 'pig',
      classPrefix: 'pig',
      figureTagName: 'figure',
      groupTitleHeight: 100,
      spaceBetweenImages: 8,
      transitionSpeed: 500,
      primaryImageBufferHeight: 1000,
      secondaryImageBufferHeight: 300,
      thumbnailSize: 20,

      urlForSize: function(filename, size) {
        return '/img/' + size + '/' + filename;
      },
      getMinAspectRatio: function(lastScrollElementWidth) {
        if (lastScrollElementWidth <= 640)
          return 2;
        else if (lastScrollElementWidth <= 1280)
          return 4;
        else if (lastScrollElementWidth <= 1920)
          return 5;
        return 6;
      },
      getImageSize: function(lastScrollElementWidth) {
        if (lastScrollElementWidth <= 640)
          return 100;
        else if (lastScrollElementWidth <= 1920)
          return 250;
        return 500;
      }
    };

    // We extend the default settings with the provided overrides.
    _extend(this.settings, options || {});

    // Our global reference for images in the grid.  Note that not all of these
    // images are necessarily in view or loaded.
    this.elements = this._parseImageData(imageData);

    // Inject our boilerplate CSS.
    _injectStyle(this.settings.containerId, this.settings.classPrefix, this.settings.transitionSpeed, this.settings.groupTitleHeight);

    // Allows for chaining with `enable()`.
    return this;
  }


  Pig.prototype._getTransitionTimeout = function() {
    var transitionTimeoutScaleFactor = 1.5;
    return this.settings.transitionSpeed * transitionTimeoutScaleFactor;
  };


  Pig.prototype._getTransitionString = function() {
    if (this.isTransitioning) {
      return (this.settings.transitionSpeed / 1000) + 's transform ease';
    }

    return 'none';
  };


  Pig.prototype._recomputeMinAspectRatio = function() {
    var oldMinAspectRatio = this.minAspectRatio;
    this.minAspectRatio = this.settings.getMinAspectRatio(this.lastScrollElementWidth);

    if (oldMinAspectRatio !== null && oldMinAspectRatio !== this.minAspectRatio)
      this.minAspectRatioRequiresTransition = true;
    else
      this.minAspectRatioRequiresTransition = false;
  };


  Pig.prototype._parseImageData = function (imageData) {
    var progressiveElements = [],
        titleIndex = 0;

    imageData.forEach(function (image, index) {
      if(index === 0) {
        createTitleData.call(this, image);
      }

      var progressiveImage = new ProgressiveImage(image, index, this);
      progressiveElements.push(progressiveImage);

      if (imageData[index + 1] && image[this.settings.groupKey] !== imageData[index + 1][this.settings.groupKey]) {
        createTitleData.call(this, imageData[index + 1]);
      }


      function createTitleData(titleData) {
        var title = {
          sessionId:    titleData.sessionId, // Session Id
          submissionId: titleData.submissionId // Submission Id
        },
        progressiveTitle = new ProgressiveTitle(title, titleIndex, this);

        titleIndex++;

        progressiveElements.push(progressiveTitle);
      }

    }.bind(this));

    return progressiveElements;
  };


  Pig.prototype._computeLayout = function() {
    // Constants
    var wrapperWidth = parseInt(this.container.clientWidth);

    var row = [];           // The list of images in the current row.
    var translateX = this.settings.spaceBetweenImages;     // The current translateX value that we are at
    var translateY = 0;     // The current translateY value that we are at
    var rowAspectRatio = 0; // The aspect ratio of the row we are building
    var lastRowLength = null;
    var lastRowAspectRatio = null;

    // Compute the minimum aspect ratio that should be applied to the rows.
    this._recomputeMinAspectRatio();

    // If we are not currently transitioning, and our minAspectRatio has just
    // changed, then we mark isTransitioning true. If this is the case, then
    // `this._getTransitionString()` will ensure that each image has a value
    // like "0.5s ease all". This will cause images to animate as they change
    // position. (They need to change position because the minAspectRatio has
    // changed.) Once we determine that the transtion is probably over (using
    // `this._getTransitionTimeout`) we unset `this.isTransitioning`, so that
    // future calls to `_computeLayout` will set "transition: none".
    if (!this.isTransitioning && this.minAspectRatioRequiresTransition) {
      this.isTransitioning = true;
      setTimeout(function() {
        this.isTransitioning = false;
      }, this._getTransitionTimeout());
    }

    // Get the valid-CSS transition string.
    var transition = this._getTransitionString();

    // Loop through all our images, building them up into rows and computing
    // the working rowAspectRatio.
    [].forEach.call(this.elements, function(el, index) {
      row.push(el);

      // ProgressiveTitle
      if(el instanceof ProgressiveTitle) {
        translateX = 0;

        row.forEach(function(title) {
          // This is NOT DOM manipulation.
          title.style = {
            height:     this.settings.groupTitleHeight,
            translateX: translateX,
            translateY: translateY,
            transition: transition,
          };
        }.bind(this));

        // Reset our state variables for next row.
        row = [];
        rowAspectRatio = 0;
        translateX = this.settings.spaceBetweenImages;
        translateY += this.settings.groupTitleHeight + this.settings.spaceBetweenImages;

      // ProgressiveImage
      } else if (el instanceof ProgressiveImage) {
        rowAspectRatio += parseFloat(el.aspectRatio);

        // When the rowAspectRatio exceeeds the minimum acceptable aspect ratio,
        // or when we're out of images, we say that we have all the images we
        // need for this row, and compute the style values for each of these
        // images.
        if (rowAspectRatio >= this.minAspectRatio ||
            index + 1 === this.elements.length ||
            (this.elements[index + 1] && this.elements[index + 1] instanceof ProgressiveTitle)) {


          if(rowAspectRatio >= this.minAspectRatio) {
            // Make sure that the last row also has a reasonable height
            rowAspectRatio = Math.max(rowAspectRatio, this.minAspectRatio);

            lastRowLength = row.length;
            lastRowAspectRatio = rowAspectRatio;
          }

          if(!lastRowLength || !lastRowAspectRatio) {
            rowAspectRatio = this.minAspectRatio;
            lastRowLength = row.length;
            lastRowAspectRatio = rowAspectRatio;
          }

          // Compute this row's height.
          var totalDesiredWidthOfImages = wrapperWidth - this.settings.spaceBetweenImages * (lastRowLength + 1);
          var rowHeight = totalDesiredWidthOfImages / lastRowAspectRatio;

          // For each image in the row, compute the width, height, translateX,
          // and translateY values, and set them (and the transition value we
          // found above) on each image.
          //
          // NOTE: This does not manipulate the DOM, rather it just sets the
          //       style values on the ProgressiveImage instance. The DOM nodes
          //       will be updated in _doLayout.
          row.forEach(function(img) {

            var imageWidth = rowHeight * img.aspectRatio;

            // This is NOT DOM manipulation.
            img.style = {
              width: parseInt(imageWidth),
              height: parseInt(rowHeight),
              translateX: translateX,
              translateY: translateY,
              transition: transition,
            };

            // The next image is this.settings.spaceBetweenImages pixels to the
            // right of this image.
            translateX += imageWidth + this.settings.spaceBetweenImages;

          }.bind(this));

          // Reset our state variables for next row.
          row = [];
          rowAspectRatio = 0;
          translateY += parseInt(rowHeight) + this.settings.spaceBetweenImages;
          translateX = this.settings.spaceBetweenImages;
        }
      }

    }.bind(this));

    // No space below the last image
    this.totalHeight = translateY - this.settings.spaceBetweenImages;
  };


  /**
   * get container total height
  **/
  Pig.prototype._setTotalHeight = function() {
    var wrapperWidth = document.getElementById('photos').clientWidth;
    // State
    var row = [];           // The list of images in the current row.
    var translateX = 0;     // The current translateX value that we are at
    var translateY = 0;     // The current translateY value that we are at
    var rowAspectRatio = 0; // The aspect ratio of the row we are building

    // Compute the minimum aspect ratio that should be applied to the rows.
    this._recomputeMinAspectRatio();

    // Loop through all our images, building them up into rows and computing
    // the working rowAspectRatio.
    [].forEach.call(this.elements, function(el, index) {
      row.push(el);

      // ProgressiveTitle
      if(el instanceof ProgressiveTitle) {
        // Reset our state variables for next row.
        row = [];
        rowAspectRatio = 0;
        translateY += this.settings.groupTitleHeight + this.settings.spaceBetweenImages;

      // ProgressiveImage
      } else if (el instanceof ProgressiveImage) {
        rowAspectRatio += parseFloat(el.aspectRatio);

        // When the rowAspectRatio exceeeds the minimum acceptable aspect ratio,
        // or when we're out of images, we say that we have all the images we
        // need for this row, and compute the style values for each of these
        // images.
        if (rowAspectRatio >= this.minAspectRatio ||
            index + 1 === this.elements.length ||
            (this.elements[index + 1] && this.elements[index + 1] instanceof ProgressiveTitle)) {

          // Make sure that the last row also has a reasonable height
          rowAspectRatio = Math.max(rowAspectRatio, this.minAspectRatio);

          // Compute this row's height.
          var totalDesiredWidthOfImages = wrapperWidth - this.settings.spaceBetweenImages * (row.length - 1);
          var rowHeight = totalDesiredWidthOfImages / rowAspectRatio;

          // Reset our state variables for next row.
          row = [];
          rowAspectRatio = 0;
          translateY += parseInt(rowHeight) + this.settings.spaceBetweenImages;
        }
      }

    }.bind(this));

    // No space below the last image
    this.totalHeight = translateY - this.settings.spaceBetweenImages;
  };


  Pig.prototype._doLayout = function() {

    // Set the container height
    this.container.style.height = this.totalHeight + 'px';

    // Get the top and bottom buffers heights.
    var bufferTop =
      (this.scrollDirection === 'up') ?
      this.settings.primaryImageBufferHeight :
      this.settings.secondaryImageBufferHeight;
    var bufferBottom =
      (this.scrollDirection === 'down') ?
      this.settings.primaryImageBufferHeight :
      this.settings.secondaryImageBufferHeight;

    // Now we compute the location of the top and bottom buffers:
    var scrollElementHeight = this.scrollElement.offsetHeight;
    var minTranslateY       = this.latestYOffset - bufferTop;
    var maxTranslateY       = this.latestYOffset + scrollElementHeight + bufferBottom;

    // Here, we loop over every image, determine if it is inside our buffers or
    // no, and either insert it or remove it appropriately.
    this.elements.forEach(function(el) {
      if (el.style.translateY <= this.latestYOffset &&
          el.style.translateY + el.style.height >= this.latestYOffset) {
        window.name = el[this.settings.groupKey];
      }

      if (el.style.translateY + el.style.height < minTranslateY ||
          el.style.translateY > maxTranslateY) {
        // Hide Element
        el.hide();
      } else {
        // Load Element
        el.load();
      }
    }.bind(this));
  };


  Pig.prototype._getOnScroll = function() {
    var _this = this;

    var onScroll = function() {
      var newYOffset = _this.scrollElement.scrollTop;
      _this.previousYOffset = _this.latestYOffset || newYOffset;
      _this.latestYOffset = newYOffset;
      _this.scrollDirection = (_this.latestYOffset > _this.previousYOffset) ? 'down' : 'up';

      // Call _this.doLayout, guarded by window.requestAnimationFrame
      if (!_this.inRAF) {
        _this.inRAF = true;
        window.requestAnimationFrame(function() {
          _this._doLayout();
          _this.inRAF = false;
        });
      }
    };

    return onScroll;
  };


  Pig.prototype.enable = function() {
    // Find the container to load images into, if it exists.
    this.container = document.getElementById(this.settings.containerId);
    this.scrollElement = this.container.parentElement;
    if (!this.container) {
      console.error('Could not find element with ID ' + this.settings.containerId);
      return;
    }

    this.onScroll = this._getOnScroll();
    this.scrollElement.addEventListener('scroll', this.onScroll);

    this.onScroll();
    this._computeLayout();
    this._doLayout();

    optimizedResize.add(function() {
      this.lastScrollElementWidth = this.scrollElement.offsetWidth;
      this._computeLayout();
      this._doLayout();
    }.bind(this));

    return this;
  };


  Pig.prototype.disable = function() {
    this.scrollElement.removeEventListener('scroll', this.onScroll);
    optimizedResize.disable();
    return this;
  };


  Pig.prototype.updatePhotos = function(imageData) {
    var addElements = this._parseImageData(imageData);
    var submissionId = addElements[0].submissionId;

    var pastIndex = null;
    var pastLength = 0;

    this.elements.forEach(function (el, index) {
      if(el.submissionId === submissionId) {
        pastLength++;

        if(pastIndex === null) {
          pastIndex = index;
        }

        // Hide Element
        el.hide();
      }
    });

    if(pastIndex === null) {
      pastIndex = 0;
    }

    Array.prototype.splice.apply(this.elements, [pastIndex, pastLength].concat(addElements));

    this._computeLayout();
    this._doLayout();
  };


  Pig.prototype.deletePhotos = function(submissionId) {
    var deleteIndex = null;
    var deletedLength = 0;

    this.elements.forEach(function (el, index) {
      if(el.submissionId === submissionId) {
        deletedLength++;

        if(deleteIndex === null) {
          deleteIndex = index;
        }

        // Hide Element
        el.hide();
      }
    });

    if(deleteIndex === null) {
      deleteIndex = 0;
    }

    this.elements.splice(deleteIndex, deletedLength)

    this._computeLayout();
    this._doLayout();
  };


  /**
   * This class manages a single images group
   *
   *   <figure class="pig-figure" style="transform: ...">
   *     <h1>[Grouped value]</h1>
   *   </figure>
  **/
  function ProgressiveTitle(singleTitleData, index, pig) {
    this.type = 'title';

    // Global State
    this.existsOnPage = false; // True if the element exists on the page.

    // Instance information
    this.sessionId = singleTitleData.sessionId; // Session Id
    this.submissionId = singleTitleData.submissionId; // Submission Id
    this.index = index;  // The index in the list of titles

    // The Pig instance
    this.pig = pig;

    this.classNames = {
      figure: pig.settings.classPrefix + '-figure ' +
              pig.settings.classPrefix + '-figure-title'
    };

    return this;
  }

  /**
   * Load the title element associated with this ProgressiveTitle into the DOM.
   *
   * This function will append the figure into the DOM, create and insert the grouped title value.
   */
  ProgressiveTitle.prototype.load = function() {
    // Create a new title element, and insert it into the DOM. It doesn't
    // matter the order of the figure elements, because all positioning
    // is done using transforms.
    this.existsOnPage = true;
    this._updateStyles();
    this.pig.container.appendChild(this.getElement());

    // We run the rest of the function in a 100ms setTimeout so that if the
    // user is scrolling down the page very fast and hide() is called within
    // 100ms of load(), the hide() function will set this.existsOnPage to false
    // and we can exit.
    setTimeout(function() {

      // The image was hidden very quickly after being loaded, so don't bother
      // loading it at all.
      if (!this.existsOnPage) {
        return;
      }

      // Show title
      if (!this.title) {
        var titleValue = document.createTextNode(this[this.pig.settings.groupKey]);

        this.title =document.createElement("H1");
        this.title.appendChild(titleValue);

        this.getElement().appendChild(this.title);
      }
    }.bind(this), 100);
  };

  /**
   * Removes the figure from the DOM, removes the title, and
   * deletes the this.title propertie off of the
   * ProgressiveTitle object.
   */
  ProgressiveTitle.prototype.hide = function() {
    // Remove the title from the element, so that if a user is scrolling super
    // fast, we won't try to load every image we scroll past.
    if (this.getElement()) {
      if (this.title) {
        this.getElement().removeChild(this.title);
        delete this.title;
      }
    }

    // Remove the title from the DOM.
    if (this.existsOnPage) {
      this.pig.container.removeChild(this.getElement());
    }

    this.existsOnPage = false;

  };

  /**
   * Get the DOM element associated with this ProgressiveTitle. We default to
   * using this.element, and we create it if it doesn't exist.
   *
   * @returns {HTMLElement} The DOM element associated with this instance.
   */
  ProgressiveTitle.prototype.getElement = function() {
    if (!this.element) {
      this.element = document.createElement(this.pig.settings.figureTagName);
      this.element.className = this.classNames.figure;
      this._updateStyles();
    }

    return this.element;
  };

  /**
   * Updates the style attribute to reflect this style property on this object.
   */
  ProgressiveTitle.prototype._updateStyles = function() {
    this.getElement().style.transition = this.style.transition;
    this.getElement().style.height = this.style.height + 'px';
    this.getElement().style.transform = (
      'translate3d(' + this.style.translateX + 'px,' +
        this.style.translateY + 'px, 0)');
  };


  function ProgressiveImage(singleImageData, index, pig) {
    this.type = 'image';

    // Global State
    this.existsOnPage = false; // True if the element exists on the page.

    // Instance information
    this.aspectRatio = singleImageData.aspectRatio;  // Aspect Ratio
    this.filename = singleImageData.filename;  // Filename
    this.sessionId = singleImageData.sessionId; // Session Id
    this.submissionId = singleImageData.submissionId; // Submission Id
    this.index = index;  // The index in the list of images

    // The Pig instance
    this.pig = pig;

    this.classNames = {
      figure: pig.settings.classPrefix + '-figure',
      thumbnail: pig.settings.classPrefix + '-thumbnail',
      loaded: pig.settings.classPrefix + '-loaded',
    };

    return this;
  }


  ProgressiveImage.prototype.load = function() {
    this.existsOnPage = true;
    this._updateStyles();
    this.pig.container.appendChild(this.getElement());

    setTimeout(function() {
      if (!this.existsOnPage) {
        return;
      }

      // Show thumbnail
      // if (!this.thumbnail) {
      //   this.thumbnail = new Image();
      //   this.thumbnail.src = this.pig.settings.urlForSize(this.filename, this.pig.settings.thumbnailSize);
      //   this.thumbnail.className = this.classNames.thumbnail;
      //   this.thumbnail.onload = function() {

      //     // We have to make sure thumbnail still exists, we may have already been
      //     // deallocated if the user scrolls too fast.
      //     if (this.thumbnail) {
      //       this.thumbnail.className += ' ' + this.classNames.loaded;
      //     }
      //   }.bind(this);

      //   this.getElement().appendChild(this.thumbnail);
      // }

      // Show full image
      if (!this.fullImage) {
        this.fullImage = new Image();
        this.fullImage.src = this.pig.settings.urlForSize(this.filename, this.pig.settings.getImageSize(this.pig.lastScrollElementWidth));

        this.fullImage.onload = function() {
          if (this.fullImage) {
            this.fullImage.className += ' ' + this.classNames.loaded;
          }
        }.bind(this);
        // var imgSrc = this.pig.settings.urlForSize(this.filename, this.pig.settings.getImageSize(this.pig.lastScrollElementWidth));

        // _loadImg.call(this, imgSrc, successImgLoad, errorImgLoad);

        this.fullImage.addEventListener("click", function (event) {
          this.pig.settings.click(event, this.filename, this.submissionId);
        }.bind(this));

        this.getElement().appendChild(this.fullImage);
      }
    }.bind(this), 100);


    function successImgLoad(imgBase64Data) {
      if(this.fullImage) {
        this.fullImage.src = imgBase64Data;

        if (this.fullImage) {
          this.fullImage.className += ' ' + this.classNames.loaded;
        }
      }
    }


    function errorImgLoad(errorStatus) {
      console.error(errorStatus);
      this.pig.settings.error.call(this, errorStatus, renovateImg);
    }


    function renovateImg() {
       var imgSrc = this.pig.settings.urlForSize(this.filename, this.pig.settings.getImageSize(this.pig.lastScrollElementWidth));
       _loadImg.call(this, imgSrc, successImgLoad, errorImgLoad);
    }
  };

  /**
   * Removes the figure from the DOM, removes the thumbnail and full image, and
   * deletes the this.thumbnail and this.fullImage properties off of the
   * ProgressiveImage object.
   */
  ProgressiveImage.prototype.hide = function() {
    // Remove the images from the element, so that if a user is scrolling super
    // fast, we won't try to load every image we scroll past.
    if (this.getElement()) {
      if (this.thumbnail) {
        this.thumbnail.src = '';
        this.getElement().removeChild(this.thumbnail);
        delete this.thumbnail;
      }

      if (this.fullImage) {
        this.fullImage.src = '';
        this.getElement().removeChild(this.fullImage);
        delete this.fullImage;
      }
    }

    // Remove the image from the DOM.
    if (this.existsOnPage) {
      this.pig.container.removeChild(this.getElement());
    }

    this.existsOnPage = false;

  };

  /**
   * Get the DOM element associated with this ProgressiveImage. We default to
   * using this.element, and we create it if it doesn't exist.
   *
   * @returns {HTMLElement} The DOM element associated with this instance.
   */
  ProgressiveImage.prototype.getElement = function() {
    if (!this.element) {
      this.element = document.createElement(this.pig.settings.figureTagName);
      this.element.className = this.classNames.figure;
      this._updateStyles();
    }

    return this.element;
  };

  /**
   * Updates the style attribute to reflect this style property on this object.
   */
  ProgressiveImage.prototype._updateStyles = function() {
    this.getElement().style.transition = this.style.transition;
    this.getElement().style.width = this.style.width + 'px';
    this.getElement().style.height = this.style.height + 'px';
    this.getElement().style.transform = (
      'translate3d(' + this.style.translateX + 'px,' +
        this.style.translateY + 'px, 0)');
  };

  // Export Pig into the global scope.
  if (typeof define === 'function' && define.amd) {
    define(Pig);
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = Pig;
  } else {
    global.Pig = Pig;
  }

}(this));
