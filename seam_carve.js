$(document).ready(function(){

	var canvas = document.getElementById("myCanvas");
	var context = canvas.getContext("2d");
	var img = document.createElement("img");
	var mouseDown = false;
	var hasText = true;
	var imgWidth = -1;
	var imgHeight = -1;
	var lod = 0; //level of detail
    var horiz_lod = 0; //level of detail horizontal
	var seam_highlight = false;

	//array of seams to change lod
	var cut_seams = [];
    var horiz_cut_seams = [];

	var clearCanvas = function () {
		if (hasText) {
			context.clearRect(0, 0, canvas.width, canvas.height);
			hasText = false;
		}
	};

	// Adding instructions
	context.fillText("Drop an image onto the canvas", 240, 200);
	context.fillText("Click a spot to set as brush color", 240, 220);

	// Image for loading
	img.addEventListener("load", function () {
		clearCanvas();
		canvas.height = img.height;
		canvas.width = img.width*1.5;
		imgHeight = img.height;
		imgWidth = img.width;
        $("#width-slider").slider({max: img.width*1.5, value: img.width});
        $("#height-slider").slider({max: img.height*1.5, value: img.height});
		context.drawImage(img, 0, 0);

		var imgData = context.getImageData(0,0,imgWidth,imgHeight);
		cut_seams = Filters.get_paths(imgData);

	}, false);

	// To enable drag and drop
	canvas.addEventListener("dragover", function (evt) {
		evt.preventDefault();
	}, false);

	// Handle dropped image file - only Firefox and Google Chrome
	canvas.addEventListener("drop", function (evt) {
		var files = evt.dataTransfer.files;
		if (files.length > 0) {
			var file = files[0];
			if (typeof FileReader !== "undefined" && file.type.indexOf("image") != -1) {
				var reader = new FileReader();
				// Note: addEventListener doesn't work in Google Chrome for this event
				reader.onload = function (evt) {
					img.src = evt.target.result;
				};
				reader.readAsDataURL(file);
			}
		}
		evt.preventDefault();
	}, false);

	// Detect mousedown
	canvas.addEventListener("mousedown", function (evt) {
		mouseDown = true;
	}, false);

	// Detect mouseup
	canvas.addEventListener("mouseup", function (evt) {
		mouseDown = false;
	}, false);

	// Draw, if mouse button is pressed
	canvas.addEventListener("mousemove", function (evt) {
		if (mouseDown) {
			//resizeImage(1);
		}
	}, false);

    var array_to_image = function(energies, width, height) {
        var output = context.createImageData(width, height);
        for (var i=0; i < energies.length; i++) {
            output.data[i*4] = energies[i];
            output.data[i*4+1] = energies[i];
            output.data[i*4+2] = energies[i];
            output.data[i*4+3] = 255;
        }
        context.putImageData(output,0,0);
        return output;
    };

    $("#width-slider").on('slide', $.debounce(250, function(e){
        var amount = e.value-imgWidth;
        if (amount < 0) {
          for (var i=0; i<Math.abs(amount); i++) {
              var imgData = context.getImageData(0,0,imgWidth,imgHeight);
              var path = Filters.get_path(imgData);
              remove_row(path);
          }
        } else {
          resizeImage(Math.abs(amount));
        }
    }));

    $(document).keydown(function(e){
        // keypad left
        if (e.keyCode == 37) {
			down_lod(1);
            $("#width-slider").slider('setValue',imgWidth);
        // keypad right
        } else if (e.keyCode == 39) {
			up_lod(1);
            $("#width-slider").slider('setValue',imgWidth);
        } else if (e.keyCode == 38) {
            down_horiz_lod(1);
            $("#height-slider").slider('setValue',imgHeight);
        }
        return false;
    });

	$("#wider-horiz").click(function(){
		resizeImage(5);
	});

	$("#shorter-horiz").click(function(){
		for (var i=0; i<5; i++){
			var imgData = context.getImageData(0,0,imgWidth,imgHeight);
			var path = Filters.get_path(imgData);
			remove_row(path); // TODO: change to remove_column
		}
	});

    $("#energy1").click(function() {
        var imgData = context.getImageData(0,0,imgWidth,imgHeight);
        context.clearRect(0, 0, canvas.width, canvas.height);
        var energies = Filters.energy1(imgData);
        var newimg = array_to_image(energies, imgWidth, imgHeight);
        context.putImageData(newimg, 0, 0);
    });

	$("#highlight").click(function(){
		seam_highlight = !seam_highlight;
	});


	var remove_row = function(path){
		var imgData = context.getImageData(0, 0, imgWidth, imgHeight); // single dimension array of RGBA
        imgWidth -= 1;

        var newImg = context.createImageData(imgWidth, imgHeight);

		var path_index = 0;
		var new_index = 0;
		var dirty_x = 0;

		for (var i=0; i < imgData.data.length/4; i+=1){
			if (path[path_index].getIndex(imgWidth+1,path_index) === i){
				dirty_x = Math.min(dirty_x, path[path_index].index);
				path_index = Math.min(path_index+1,path.length-1);
				continue;
			}
			newImg.data[4*new_index] = imgData.data[4*i];
			newImg.data[4*new_index+1] = imgData.data[4*i+1];
			newImg.data[4*new_index+2] = imgData.data[4*i+2];
			newImg.data[4*new_index+3] = imgData.data[4*i+3];
			new_index++;
		}

		context.putImageData(newImg,0,0,dirty_x,0,imgWidth-dirty_x, canvas.height);
		context.clearRect(newImg.width, 0, 1, canvas.height);
	};

	var remove_row_fast = function(path){
		// Find min and max x values of seam
		var min_x = Number.MAX_VALUE;
		var max_x = Number.MIN_VALUE;

		for (var p=0; p<path.length; p++) {
			min_x = Math.min(min_x, path[p].index);
			max_x = Math.max(max_x, path[p].index);
		}
		// single dimension array of RGBA
		var midImgData = context.getImageData(min_x, 0, max_x-min_x+1, imgHeight);
		var newImg = context.createImageData(max_x-min_x, imgHeight);

		//Remove seam from middle part
		var new_index=0;
		var old_index = 0;
		for (var y=0; y<imgHeight; y++){
			for (var x=min_x; x<=max_x; x++){
				if (path[y].index === x){
					old_index++;
					continue;
				}
				newImg.data[4*new_index] = midImgData.data[4*old_index];
				newImg.data[4*new_index+1] = midImgData.data[4*old_index+1];
				newImg.data[4*new_index+2] = midImgData.data[4*old_index+2];
				newImg.data[4*new_index+3] = midImgData.data[4*old_index+3];
				new_index++;
				old_index++;
			}
		}

        // put new image data in right place
		context.putImageData(newImg,min_x,0);

		//shift clean data on right side of seam over 1 pixel
		var rightImgData = context.getImageData(max_x+1, 0, imgWidth-max_x-1, imgHeight);
		context.putImageData(rightImgData,max_x,0);

		imgWidth -= 1;
		context.clearRect(imgWidth, 0, 1, canvas.height);
	};

	var add_row = function(path){
		var imgData = context.getImageData(0, 0, imgWidth, imgHeight); // single dimension array of RGBA
		imgWidth += 1;
		var newImg = context.createImageData(imgWidth, imgHeight);
		var path_index = 0;
		var new_index = 0;
		var dirty_x = 0;
		for (var i=0; i < imgData.data.length/4; i+=1){
			if (path[path_index].getIndex(imgWidth-1,path_index) === i){
				dirty_x = Math.min(dirty_x, path[path_index].index);
				newImg.data[4*new_index] = path[path_index].r;
				//Highlight seams by order of removal
				if (seam_highlight) {
					newImg.data[4*new_index] += lod;
					newImg.data[4*new_index] = Math.min(newImg.data[4*new_index],255);
				}
				newImg.data[4*new_index+1] = path[path_index].g;
				newImg.data[4*new_index+2] = path[path_index].b;
				newImg.data[4*new_index+3] = 255;
				path_index = Math.min(path_index+1,path.length-1);
				new_index++;
			}
			newImg.data[4*new_index] = imgData.data[4*i];
			newImg.data[4*new_index+1] = imgData.data[4*i+1];
			newImg.data[4*new_index+2] = imgData.data[4*i+2];
			newImg.data[4*new_index+3] = imgData.data[4*i+3];
			new_index++;
		}
		context.putImageData(newImg,0,0,dirty_x,0,imgWidth-dirty_x, canvas.height);
	};

	var add_row_fast = function(path){
		// Find min and max x values of seam
		var min_x = Number.MAX_VALUE;
		var max_x = Number.MIN_VALUE;

		for (var p=0; p<path.length; p++) {
			min_x = Math.min(min_x, path[p].index);
			max_x = Math.max(max_x, path[p].index);
		}
		// single dimension array of RGBA
		var midImgData = context.getImageData(min_x, 0, max_x-min_x+1, imgHeight);
		var newImg = context.createImageData(max_x-min_x+2, imgHeight);

		//Remove seam from middle part
		var new_index=0;
		var old_index = 0;
		for (var y=0; y<imgHeight; y++){
			for (var x=min_x; x<=max_x; x++){
				if (path[y].index === x){
					newImg.data[4*new_index] = path[y].r;
					newImg.data[4*new_index+1] = path[y].g;
					newImg.data[4*new_index+2] = path[y].b;
					newImg.data[4*new_index+3] = 255;
					new_index++;
				}
				newImg.data[4*new_index] = midImgData.data[4*old_index];
				newImg.data[4*new_index+1] = midImgData.data[4*old_index+1];
				newImg.data[4*new_index+2] = midImgData.data[4*old_index+2];
				newImg.data[4*new_index+3] = midImgData.data[4*old_index+3];
				new_index++;
				old_index++;
			}
		}

		//shift clean data on right side of seam over 1 pixel
		var rightImgData = context.getImageData(max_x+1, 0, imgWidth-max_x-1, imgHeight);
		context.putImageData(rightImgData,max_x+2,0);

        // put new image data in right place
		context.putImageData(newImg,min_x,0);

		imgWidth += 1;
	};


	var down_lod = function(times) {
		for (var i=0; i<times; i++){
			if (lod>=cut_seams.length) break;
			seam = cut_seams[lod];
			lod++;
			//remove_row(seam);
			remove_row_fast(seam);
		}
	};

	var up_lod = function(times) {
		for (var i=0; i<times; i++){
			if (lod < 1) break;
			lod--;
			seam = cut_seams[lod];
			//add_row(seam);
			add_row_fast(seam);
		}
	};

    var down_horiz_lod = function(times) {
        for (var i=0; i<times; i++) {
            if (horiz_lod >= horiz_cut_seams.length) break;
            seam = horiz_cut_seams[horiz_lod];
            horiz_lod++;
            remove_col_fast(seam);
        }
    };

    var up_horiz_lod = function(times) {
        for (var i=0; i<times; i++) {
            if (horiz_lod < 1) break;
            horiz_lod--;
            seam = horiz_cut_seams[horiz_lod];
            add_col_fast(seam);
        }
    };

	var remove_column = function(path){
		var imgData = context.getImageData(0, 0, imgWidth, imgHeight); // single dimension array of RGBA
        imgHeight -= 1;
        var newImg = context.createImageData(imgWidth, imgHeight);

		var path_index = 0;
		var new_index = 0;

		for (var i=0; i < imgData.data.length/4; i+=1){
            var idx = (i%imgHeight)*imgWidth + Math.floor(i / imgHeight);
            var newidx = (new_index%imgHeight)*imgWidth + Math.floor(new_index / imgHeight);
            if (path[path_index]+1 === i) {
				path_index++;
				continue;
			}
			newImg.data[4*newidx] = imgData.data[4*idx];
			newImg.data[4*newidx+1] = imgData.data[4*idx+1];
			newImg.data[4*newidx+2] = imgData.data[4*idx+2];
			newImg.data[4*newidx+3] = imgData.data[4*idx+3];
			new_index++;
		}
        context.clearRect(0, 0, canvas.width, canvas.height);
		context.putImageData(newImg,0,0);
	};

	var remove_col_fast = function(path){
		// Find min and max y values of seam
		var min_y = Number.MAX_VALUE;
		var max_y = Number.MIN_VALUE;

		for (var p=0; p<path.length; p++) {
			min_y = Math.min(min_y, path[p].index);
			max_y = Math.max(max_y, path[p].index);
		}
		// single dimension array of RGBA
        var midImgData = context.getImageData(0, min_y, imgWidth, max_y-min_y+1);
        var newImg = context.createImageData(imgWidth, max_y-min_y);

		//Remove seam from middle part
		var new_index = 0;
        var old_index = 0;
        var w = imgWidth;
        for (var y=min_y; y<=max_y; y++) {
            for (var x=0; x<imgWidth; x++) {
                var offset = Math.min(4*((y-min_y)*w+x), newImg.data.length);
                var nextoffset = Math.min(4*((y-min_y+1)*w+x), newImg.data.length);
                if (path[x].index >= y) {
                    newImg.data[offset]   = midImgData.data[nextoffset];
                    newImg.data[offset+1] = midImgData.data[nextoffset+1];
                    newImg.data[offset+2] = midImgData.data[nextoffset+2];
                    newImg.data[offset+3] = midImgData.data[nextoffset+3];
                } else {
                    newImg.data[offset]   = midImgData.data[offset];
                    newImg.data[offset+1] = midImgData.data[offset+1];
                    newImg.data[offset+2] = midImgData.data[offset+2];
                    newImg.data[offset+3] = midImgData.data[offset+3];
                }
            }
        }
        console.log(newImg);

        // put new image data in right place
		context.putImageData(newImg,0,min_y);

		//shift clean data on bottom side of seam up 1 pixel
        var bottomImgData = context.getImageData(0, max_y+1, imgWidth, imgHeight-max_y-1);
        context.putImageData(bottomImgData, 0, max_y);

		imgHeight -= 1;
        context.clearRect(0, imgHeight, canvas.width, 1);
	};

});
