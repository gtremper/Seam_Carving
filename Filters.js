Filters = {};

Filters.convolute = function(pixels, weights, opaque) {
	var side = Math.round(Math.sqrt(weights.length));
	var halfSide = Math.floor(side/2);
	var src = pixels.data;
	var sw = pixels.width;
	var sh = pixels.height;
	// pad output by the convolution matrix
	var w = sw;
	var h = sh;
	var output = Filters.createImageData(w, h);
	var dst = output.data;
	// go through the destination image pixels
	var alphaFac = opaque ? 1 : 0;
	for (var y=0; y<h; y++) {
		for (var x=0; x<w; x++) {
			var sy = y;
			var sx = x;
			var dstOff = (y*w+x)*4;
			// calculate the weighed sum of the source image pixels that
			// fall under the convolution matrix
			var r=0, g=0, b=0, a=0;
			for (var cy=0; cy<side; cy++) {
				for (var cx=0; cx<side; cx++) {
					var scy = sy + cy - halfSide;
					var scx = sx + cx - halfSide;
					if (scy >= 0 && scy < sh && scx >= 0 && scx < sw) {
						var srcOff = (scy*sw+scx)*4;
						var wt = weights[cy*side+cx];
						r += src[srcOff] * wt;
						g += src[srcOff+1] * wt;
						b += src[srcOff+2] * wt;
						a += src[srcOff+3] * wt;
					}
				}
			}
			dst[dstOff] = Math.abs(r);
			dst[dstOff+1] = Math.abs(g);
			dst[dstOff+2] = Math.abs(b);
			dst[dstOff+3] = 255;
		}
	}
	return output;
};

Filters.color_energy1 = function(pixels) {
	var src = pixels.data;
	var sw = pixels.width;
	var sh = pixels.height;
	// pad output by the convolution matrix
	var w = sw;
	var h = sh;
	var output = Filters.createImageData(w, h);
	var dst = output.data;
	// go through the destination image pixels
	for (var y=0; y<h; y++) {
		for (var x=0; x<w; x++) {
			var sy = y;
			var sx = x;
			var dstOff = (y*w+x)*4;
			// calculate the weighed sum of the source image pixels that
			// fall under the convolution matrix
			var r=0, g=0, b=0;
			if (x%w >= 1 && x%w <= w-1) {
					r = Math.abs(src[dstOff-4] - src[dstOff+4]);
					g = Math.abs(src[dstOff+1-4] - src[dstOff+1+4]);
					b = Math.abs(src[dstOff+2-4] - src[dstOff+2+4]);
			}
			dst[dstOff] = r;
			dst[dstOff+1] = g;
			dst[dstOff+2] = b;
			dst[dstOff+3] = 255;
		}
	}
	return output;
};

Filters.grayscale = function(pixels) {
	var d = pixels.data;
	for (var i=0; i<d.length; i+=4) {
		var r = d[i];
		var g = d[i+1];
		var b = d[i+2];
		var v = 0.2126*r + 0.7152*g + 0.0722*b;
		d[i] = d[i+1] = d[i+2] = v
	}
	return pixels;
};

Filters.greyscale = Filters.grayscale;

Filters.energy1 = function(pixels) {
	var src = pixels.data;
	var w = pixels.width;
	var h = pixels.height;
	var output = [];
	// Pad first row with zeros
	for (var i=0; i<w; i++) {
		output.push(0);
	}
	// go through the destination image pixels
	var r,g,b;
	var row_length = w*4;
	for (var y=1; y<h-1; y++) {
		for (var x=0; x<w; x++) {
			
			var dstOff = (y*w+x)*4;
			r=0; g=0; b=0;
			//Horizontal Gradient
			if (x%w >= 1 && x%w <= w-1) {
					r += Math.abs(src[dstOff-4] - src[dstOff+4]);
					g += Math.abs(src[dstOff+1-4] - src[dstOff+1+4]);
					b += Math.abs(src[dstOff+2-4] - src[dstOff+2+4]);
			}
			//Vertical Gradient
			r += Math.abs(src[dstOff-row_length] - src[dstOff+row_length]);
			g += Math.abs(src[dstOff+1-row_length] - src[dstOff+1+row_length]);
			b += Math.abs(src[dstOff+2-row_length] - src[dstOff+2+row_length]);
			var v = 0.2126*r + 0.7152*g + 0.0722*b;
			output.push(v);
		}
	}
	for (var i=0; i<w; i++) {
		output.push(0);
	}
	return output;
};

Filters.get_path = function(pixels) {
		var energies = Filters.energy1(pixels);
		var w = pixels.width; // x
		var h = pixels.height; // y
		var M = [];
		for (var i=0; i<w; i++) M.push(0);
		var paths = [];
		// compute the dynamic programming problem
		for (var y=1; y<h; y++) { // skip the first row
			M[y*w] = 9999999999999999;
			M[(y+1)*w-1] = 9999999999999999;
			for (var x=1; x<w-1; x++) {
				var offset = (y*w+x);
				var topleft = M[(y-1)*w+x-1];
				var topmid = M[(y-1)*w+x];
				var topright = M[(y-1)*w+x+1];
				var energy_to_add = 0;
				if (topleft < topmid && topleft < topright) {
						energy_to_add = topleft;
						paths[offset] = (y-1)*w+x-1;
				} else if (topmid < topleft && topmid < topright) {
						energy_to_add = topmid;
						paths[offset] = (y-1)*w+x;
				} else {
						energy_to_add = topright;
						paths[offset] = (y-1)*w+x+1;
				}
				M[offset] = energies[y*w+x] + energy_to_add;
			}
		}

		// find index of the smallest value in the last row of M
		var minvalue = 9999999999999999999999;
		var index = -1;
		for (var i=M.length - w; i < M.length; i++) {
				if (M[i] < minvalue) {
					index = i;
					minvalue = M[i];
				}
		}
		
		console.log(w + ": " + minvalue);

		var path = [index];
		for (var i=1; i<h; i++) { // do this h-1 times
			 path.push( paths[index] );
			 index = paths[index];
		}
		// do this janky stuff for graham
		path.reverse();
		path.push(-1);
		return path;
};

Filters.to_columnmajor = function(imgData, context) {
    var array = imgData.data
    var height = imgData.height;
    var width = imgData.width;
    var newarray = [];
    var r = c = 0;
    for (var i=0; i<array.length; i++) {
        r = i % height;
        c = Math.floor(i / height);
        newarray[r*width+c] = array[i];
    }
    var newImg = context.createImageData(height,width);
    newImg.data = newarray;
    newImg.width = height;
    newImg.height = width;
    return newImg;
};

Filters.to_rowmajor = function(imgData, context) {
    var array = imgData.data
    var height = imgData.width;
    var width = imgData.height;
    var newarray = [];
    var r = c = 0;
    for (var i=0; i<array.length; i++) {
        r = i % height;
        c = Math.floor(i / height);
        newarray[r*width+c] = array[i];
    }
    var newImg = context.createImageData(height,width);
    newImg.data = newarray;
    newImg.width = height;
    newImg.height = width;
    return newImg;
};
