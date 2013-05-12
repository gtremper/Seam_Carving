Filters = {};


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

// Add extra paths(seams) to increase image beyond original size
Filters.extend_paths = function(paths, pixels) {
	var w = pixels.width;
	var h = pixels.height;
	for (var i=0; i<paths.length/2; i++) {
		var new_path = [];
		for (var row=0; row<h; row++){
			var index = paths[i][row].index;
			//update index to account for previous seams removed
			for (var p=0; p<i; p++) {
				if (index >= paths[p][row]) {
					index+=2;
				}
			}
			new_path[row] = new Pixel(index, -1, -1, -1);
		}
		// Jenkily set new seams to negative indices in paths
		paths[-i] = new_path;
	}
	
	return paths;
};



Filters.get_paths = function(pixels) {
	var w = pixels.width; // x
	var h = pixels.height; // y

	var pixel_data = [];
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
		var path = [];
		var path_index=0;
		for (var pix=indicies[0]; pix<pixel_data.length/3; pix++){
			if (indicies[path_index] === pix){
				var pixel = new Pixel(pix%w, //row index
								pixel_data[pix*3], //r
								pixel_data[pix*3+1], //g
								pixel_data[pix*3+2]); //b
				path.push( pixel )
				path_index = Math.min(path_index+1, h-1);
			} else {
				pixel_data[3*(pix-path_index)] = pixel_data[3*pix];
				pixel_data[3*(pix-path_index)+1] = pixel_data[3*pix+1];
				pixel_data[3*(pix-path_index)+2] = pixel_data[3*pix+2];
			}
		}
		pixel_data.length -= 3*h;

		list_of_paths.push(path);
		w -= 1;
	}
	
	list_of_paths = Filters.extend_paths(list_of_paths, pixels);
	
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

Filters.get_path = function(pixels) {
  var energies = Filters.energy1(pixels.data,pixels.width,pixels.height);
  var w = pixels.width; // x
  var h = pixels.height; // y
  var M = [];
  for (var i=0; i<w; i++) M.push(0);
  var paths = [];
  // compute the dynamic programming problem
  for (var y=1; y<h; y++) { // skip the first row
    M[y*w] = Number.MAX_VALUE;
    M[(y+1)*w-1] = Number.MAX_VALUE;
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
  var minvalue = Number.MAX_VALUE;
  var index = -1;
  for (var i=M.length - w; i < M.length; i++) {
    if (M[i] < minvalue) {
      index = i;
      minvalue = M[i];
    }
  }

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

Filters.get_horiz_path = function(pixels) {
    var energies = Filters.energy1(pixels.data, pixels.width, pixels.height);
    var w = pixels.width;
    var h = pixels.height;
    var M = [];
    for (var i=0; i<h; i++) M[i*w] = 0;
    var paths = [];
    for (var x=1; x<w; x++) { // skip first column
        M[x-1] = Number.MAX_VALUE;
        M[(x-1)+(h-1)*w] = Number.MAX_VALUE;
        for (var y=1; y<h-1; y++) {
            var lefttop = M[w*(y-1)+x-1];
            var leftmid = M[w*y+x-1];
            var leftbot = M[w*(y+1)+x-1]; // don't exceed array bounds
            var energy_to_add = 0;
            if (lefttop < leftmid && lefttop < leftbot) {
                energy_to_add = lefttop;
                paths[x+y*w] = w*(y-1)+x-1;
            } else if (leftmid < lefttop && leftmid < leftbot) {
                energy_to_add = leftmid;
                paths[x+y*w] = w*y+x-1;
            } else {
                energy_to_add = leftbot;
                paths[x+y*w] = w*(y+1)+x-1;
            }
            M[x+y*w] = energies[x+y*w] + energy_to_add;
        }
    }
    console.log(M.length);
    console.log(h*w);
    console.log(M);
    console.log(paths);

    // find index of smallest value in last column of M
    var minvalue = Number.MAX_VALUE;
    var index = -1;
    for (var i=w-1; i< M.length; i+=w) {
        if (M[i] < minvalue) {
          index = i;
          minvalue = M[i];
        }
    }
    console.log(index);

    var path = [index];
    for (var i=1; i<w; i++) { // do this w-1 times
        path.push( paths[index] );
        index = paths[index];
    }

    path.reverse();
    path.push(-1);
    return path;
}

Filters.get_horiz_paths = function(pixels) {
    var w = pixels.width; // x
    var h = pixels.height; // y

    pixel_data = [];
    for (var i=0; i<pixels.data.length; i++) {
      if (i%4 === 3) { // remove alphas
        continue;
      }
      pixel_data.push(pixels.data[i]);
    }

    var list_of_paths = [];
    var half_rows = Math.floor(h/2);

    // Iterate over number of seams removed
    for (var col=0; col <= half_rows; col++) {
        var energies = Filters.energy1(pixel_data, w, h);
        var M = [];
        var paths = [];
		for (var i=0; i<h; i++){
            M[i*w] = Math.random();
            paths.push(-1);
		}

        // compute the dynamic programming problem
        for (var x=1; x<w; x++) { // skip first column
            M[x-1] = Number.MAX_VALUE;
            M[x-1+(h-1)*w] = Number.MAX_VALUE;
            for (var y=1; y<h-1; y++) {
                var lefttop = M[w*(y-1)+x-1];
                var leftmid = M[w*y+x-1];
                var leftbot = M[w*(y+1)+x-1]; // don't exceed array bounds
                var energy_to_add = 0;
                if (lefttop < leftmid && lefttop < leftbot) {
                    energy_to_add = lefttop;
                    paths[x+y*w] = w*(y-1)+x-1;
                } else if (leftmid < lefttop && leftmid < leftbot) {
                    energy_to_add = leftmid;
                    paths[x+y*w] = w*y+x-1;
                } else {
                    energy_to_add = leftbot;
                    paths[x+y*w] = w*(y+1)+x-1;
                }
                M[x+y*w] = energies[x+y*w] + energy_to_add;
            }
        }

        // find index of smallest value in last col of M
        var minvalue = Number.MAX_VALUE;
        var index = -1;
        for (var i=w-1; i< M.length; i+=w) {
            if (M[i] < minvalue) {
              index = i;
              minvalue = M[i];
            }
        }

        // Get path of pixels(in reverse order) of min energy seam
        var indices = [];
        while(index>=0){
            indices.push(index);
            index = paths[index];
        }
        indices.reverse();

        // Copy new data array with seam removed
        var new_pixel_data = [];
        var path = [];
        var path_index = 0;
        for (var pix=0; pix<pixel_data.length/3; pix++) {
            var pix_idx = (pix % h) * w + Math.floor(pix / h);
            if (indices[path_index] === pix_idx) {
                var pixel = new Pixel(Math.floor(pix_idx / w), // col index
                                      pixel_data[pix_idx*3], // r
                                      pixel_data[pix_idx*3+1], // g
                                      pixel_data[pix_idx*3+2]); // b
                path.push( pixel );
                path_index = Math.min(path_index+1, w-1);
            } else { // TODO: this is probably wrong
                new_pixel_data.push(pixel_data[3*pix_idx]);
                new_pixel_data.push(pixel_data[3*pix_idx+1]);
                new_pixel_data.push(pixel_data[3*pix_idx+2]);
            }
        }
        pixel_data = new_pixel_data;

        list_of_paths.push(path);
        h -= 1;
    }
    return list_of_paths;
};
