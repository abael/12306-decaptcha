//require('underscore');

var decaptcha = (typeof module !== "undefined" && module.exports) || {};

(function(exports){
var inNODE;

var BG = "rgba(255, 255, 255, 255)",
  LETTER_HEIGHT = 14;
var Canvas;
if(typeof module !== "undefined" && module.exports){
  Canvas = require('canvas');
  inNODE = true;
}else{
  Canvas = function(width, height){
    var c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  };
  inNODE = false;
}
var blade = function(){
  var fn = function(imgData){
    var ctx;
    this.sourceImage = imgData;
    this.canvas  = new Canvas(imgData.width, imgData.height);
    ctx = this.canvas.getContext('2d');
    this.context = ctx;
    ctx.drawImage(imgData, 0, 0);
  };
  fn.prototype = {
    grey: function(bindepth){
      var img = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height), 
      d = img.data, c256;
      for(var i = 0, l = d.length; i < l; i += 4){
        c256 = grey(d[i], d[i + 1], d[i + 2]);
        if(bindepth !== undefined){
          c256 = c256 > bindepth ? 255 : 0;
        }
        d[i] = d[i + 1] = d[i + 2] = c256;
      }
      this.context.putImageData(img, 0, 0);
    },
    transform: function(){
      var myc = canvasClone(this.canvas);
      this.context.save();
      this.canvas.width *= (1 + arguments[2]);
      this.canvas.height *= (1 + arguments[1]);
      this.context.fillStyle = BG;
      this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.context.setTransform.apply(this.context, arguments);
      this.context.drawImage(myc, 0, 0);
      //this.context.restore();
    },
    binSplit: function(num){
      var image = this.canvas, w = image.width, h = image.height,
        lettersPos = [], lettersData = [], start = 0, end = 0, pix, startY = h - 1, endY = 0,
        foundletter, inletter, _inletter,
        img = this.context.getImageData(0, 0, w, h), 
        data = img.data,
        min = Math.min, max = Math.max;
      for(var x = 0; x < w; x++){
        for(var y = 0; y < h; y++){
          pix = data[(y*w + x)*4];
          if(pix === 0){
            inletter = true;
            if(!_inletter){
              startY = min(startY, y);
            }
            if(y == h - 1){
              endY = h;
            }
            _inletter = true;
          }else{
            if(_inletter){
              endY = max(endY, y);
            }
            _inletter = false;
          }
        }
        if(!foundletter && inletter){
          foundletter = true;
          start = x;
        }
        if(foundletter && !inletter){
          foundletter = false;
          end = x;
          //fix height
          if(endY - startY < LETTER_HEIGHT){
            if(startY === 0){
              startY = endY - LETTER_HEIGHT;
            }else if(endY === 0){
              endY = startY + LETTER_HEIGHT;
            }
          }
          //fix height end
          
          if(end - start >= 5){
            lettersPos.push([start, end, startY, endY]);
            var _imgdata_ = this.context.getImageData(
              start, startY, end - start, endY - startY
            );
            if(startY < 0){
              for(var i = 0, m = -startY*(end - start); i < m; i++){
                _imgdata_.data[i] = '255';
              }
            }
            lettersData.push(_imgdata_);
          }
          startY = h - 1, endY = 0;
        }
        inletter = false;
      }
      if(lettersPos.length < 4){
        
      }
      
      return lettersData;
    }
  };
  var grey = function(r, g, b){
    var p = Math.pow;
    return p((p(r, 2.2)*.2973 + p(g, 2.2)*.6274 + p(b, 2.2)*.0753), 1/2.2);
  };
  return function(img){ return new fn(img) };
}();

var dataTocanvas = function(imgdata){
  var ct = new Canvas(imgdata.width, imgdata.height).getContext('2d');
  ct.putImageData(imgdata, 0, 0);
  return ct.canvas;
},
canvasClone = function(canvas){
  var ct = new Canvas(canvas.width, canvas.height).getContext('2d');
  ct.drawImage(canvas, 0, 0);
  return ct.canvas;
},
buildvector = function(imgdata){
  var d1 = [], d = imgdata.data;
  for(var i = 0, l = d.length; i < l; i += 4){
    d1.push(d[i]);
  }
  return {data: d1, width: imgdata.width, height: imgdata.height};
},
besmart = function(imgdata, trainset){
  var guess = [];
  _.each(trainset, function(imgs, letter){
    _.each(imgs, function(img, i){
      guess.push([v.relation(img, buildvector(imgdata)), letter]);
    });
  });
  guess = guess.sort().reverse();
  return guess;
},
recognizer = function(img, trainset){
  var w = img.width, h = img.height, 
    ctx = new Canvas(w, h).getContext('2d'), imageData, bl, result = [], imgs = [];
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0);
  imageData = ctx.getImageData(0, 0, w, h);
  bl = blade(img);
  
  bl.transform(1, 0, .38, 1, 0, 0);
  bl.grey(160);
  
  bl.binSplit().forEach(function(imgData, i){
    result.push(besmart(imgData, trainset));
    imgs.push(dataTocanvas(imgData));
  });
  return {result: result, imgData: imgs};
},
vectorSet = function(imgSet){
  var vSet = {};
  _.each(imgSet, function(imgs, letter){
    _.each(imgs, function(img){
      vSet[letter] = vSet[letter] || [];
      vSet[letter].push(buildvector(canvasClone(img).getContext('2d').getImageData(0, 0, img.width, img.height)));
    });
  });
  return vSet;
};

var VectorCompare = (function(){
  var fn = function(){};
  fn.prototype = {
    magnitude: function(concordance){
      var total = 0;
      concordance.data.forEach(function(item, i){
        var x = i % concordance.width, y = Math.floor(i/concordance.width)
        total += Math.pow(item*(Math.pow(x*x + y*y, 1/2)), 2);
      });
      return Math.sqrt(total)
    },
    relation: function(concordance1, concordance2){
      var relevance = 0, topvalue = 0;
      for(var i = 0, w = Math.min(concordance1.width, concordance2.width); i < w; i++){
        for(var j = 0, h = Math.min(concordance1.height, concordance2.height); j < h; j++){
          topvalue += concordance1.data[j*concordance1.width + i]*concordance2.data[j*concordance2.width + i]*(i*i + j*j);
        }
      }
      return topvalue / (this.magnitude(concordance1) * this.magnitude(concordance2));
    }
  };
  return fn;
})();

var v = new VectorCompare();

exports.recognizer = recognizer;
exports.vectorSet = vectorSet;
})(decaptcha)