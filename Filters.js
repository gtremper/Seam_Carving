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

Filters.energy1 = function(src, w, h) {
	//var src = pixels.data;
	//var w = pixels.width;
	//var h = pixels.height;
	var output = [];
	// Pad first row with zeros
	for (var i=0; i<w; i++) {
		output.push(0);
	}
	// go through the destination image pixels
	var row_length = w*3;
	for (var y=1; y<h-1; y++) {
		//pad left columnt
		output.push(0);
		for (var x=1; x<w-1; x++) {
			var dstOff = (y*w+x)*3;
			
			//Horizontal Gradient
			var r = Math.abs(src[dstOff-3] - src[dstOff+3]);
			var g = Math.abs(src[dstOff+1-3] - src[dstOff+1+3]);
			var b = Math.abs(src[dstOff+2-3] - src[dstOff+2+3]);
			//Vertical Gradient
			r += Math.abs(src[dstOff-row_length] - src[dstOff+row_length]);
			g += Math.abs(src[dstOff+1-row_length] - src[dstOff+1+row_length]);
			b += Math.abs(src[dstOff+2-row_length] - src[dstOff+2+row_length]);
			
			var v = 0.2126*r + 0.7152*g + 0.0722*b;
			output.push(v);
		}
		//pad right column
		output.push(0);
	}
	//pad Last Row. Random so edge pixel in path is random
	for (var i=0; i<w; i++) {
		output.push(Math.random());
	}
	return output;
};

function Pixel(index, r, g, b) {
	this.index = index;
	this.r = r;
	this.g = g;
	this.b = b;
	//w is width of picture
	//h is row containing pixel
	this.getIndex = function(w,h){
		return index + w*h;
	};
};

Filters.get_paths = function(pixels) {
	var w = pixels.width; // x
	var h = pixels.height; // y
	
	pixel_data = [];
	for(var derp=0; derp<pixels.data.length; derp++){
		if (derp%4 === 3){ // remove alphas
			continue;
		}
		pixel_data.push(pixels.data[derp]);
	}
	
	var list_of_paths = [];
	var half_cols = Math.floor(w/2);
	
	//Iterate over number of curves removed
	for (var row=0; row <= half_cols; row++) {
		var energies = Filters.energy1(pixel_data,w,h);
		var M = [];
		var paths = [];
		for (var i=0; i<w; i++){ 
			M.push(Math.random());
			paths.push(-1);
		}
		// compute the dynamic programming problem
		for (var y=1; y<h; y++) { // skip the first row
			M[y*w] = Number.MAX_VALUE;
			M[(y+1)*w-1] = Number.MAX_VALUE;
			for (var x=1; x<w-1; x++) {
				var offset = y*w+x;
				var topleft = M[offset-w-1];
				var topmid = M[offset-w];
				var topright = M[offset-w+1];
				if (topleft < topmid && topleft < topright) {
						M[offset] = energies[offset] + topleft;
						paths[offset] = offset-w-1;
				} else if (topmid < topright) {
						M[offset] = energies[offset] + topmid;
						paths[offset] = offset-w;
				} else {
						M[offset] = energies[offset] + topright;
						paths[offset] = offset-w+1;
				}
			}
		}
		// find index of the smallest value in the last row of M
		var minvalue = Number.MAX_VALUE;
		var index = -1;
		for (var i=M.length - w; i < M.length; i++) {
			if (M[i] < minvalue) {
				index = i;
				minvalue = M[i];
			}
		}
		
		// Get path of pixels(in reverse order) of min energy seam
		var indicies = [];
		while(index>=0){
			indicies.push(index);
			index = paths[index];
		}
		indicies.reverse();
		
		//Copy new data array with seam removed, and save seam the "path"
		var new_pixel_data = [];
		var path = [];
		var path_index=0;
		for (var pix=0; pix<pixel_data.length/3; pix++){
			if (indicies[path_index] === pix){
				var pixel = new Pixel(pix%w, //row index
								pixel_data[pix*3], //r
								pixel_data[pix*3+1], //g
								pixel_data[pix*3+2]); //b
				path.push( pixel )
				path_index = Math.min(path_index+1, h-1);
			} else {
				new_pixel_data.push(pixel_data[3*pix]);
				new_pixel_data.push(pixel_data[3*pix+1]);
				new_pixel_data.push(pixel_data[3*pix+2]);
			}
		}
		pixel_data = new_pixel_data;
		
		list_of_paths.push(path);
		w -= 1;
	}
	return list_of_paths;
};

Filters.to_columnmajor = function(imgData, context) {
    var array = imgData.data
    var height = imgData.height;
    var width = imgData.width;
    var newImg = context.createImageData(height,width);
    var r = c = base = 0;
    for (var i=0; i<array.length/4; i++) {
        r = i % height;
        c = Math.floor(i / height);
        base = ((r*width+c)*4 ) % array.length;
        newImg.data[base] = array[i*4];
        newImg.data[base+1] = array[i*4+1];
        newImg.data[base+2] = array[i*4+2];
        newImg.data[base+3] = array[i*4+3];
    }
    return newImg;
};

Filters.to_rowmajor = function(imgData, context) {
    var array = imgData.data
    var height = imgData.width;
    var width = imgData.height;
    var newImg = context.createImageData(height,width);
    var r = c = base = 0;
    for (var i=0; i<array.length/4; i++) {
        r = i % height;
        c = Math.floor(i / height);
        base = ((r*width+c)*4 ) % array.length;
        newImg.data[base] = array[i*4];
        newImg.data[base+1] = array[i*4+1];
        newImg.data[base+2] = array[i*4+2];
        newImg.data[base+3] = array[i*4+3];
    }
    return newImg;
};
