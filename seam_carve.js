$(document).ready(function(){

	var canvas = document.getElementById("myCanvas");
	var context = canvas.getContext("2d");
	var img = document.createElement("img");
	var mouseDown = false;
	var hasText = true;
	var imgWidth = -1;
	var imgHeight = -1;
	var lod = 0; //level of detail
	var seam_highlight = false;
	
	//array of seams to change lod
	var cut_seams = [];

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
			down_lod(4);
            $("#width-slider").slider('setValue',imgWidth);
        // keypad right
        } else if (e.keyCode == 39) {
			up_lod(4);
            $("#width-slider").slider('setValue',imgWidth);
        } else if (e.keyCode == 38) {
            var imgData = context.getImageData(0,0,imgWidth,imgHeight);
            var newimgData = Filters.to_columnmajor(imgData, context);
            var path = Filters.get_path(newimgData);
            $("#height-slider").slider('setValue',imgHeight);
            remove_column(path); // TODO: change to remove_column
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
	
	
	var down_lod = function(times) {
		for (var i=0; i<times; i++){
			if (lod>=cut_seams.length) break;
			seam = cut_seams[lod];
			lod++;
			remove_row(seam);
		}
	};
	
	var up_lod = function(times) {
		for (var i=0; i<times; i++){
			if (lod < 1) break;
			lod--;
			seam = cut_seams[lod];
			add_row(seam);
		}
	};

	var remove_column = function(path){
        console.log(path);
		var imgData = context.getImageData(0, 0, imgWidth, imgHeight); // single dimension array of RGBA
        imgHeight -= 1;
        var newImg = context.createImageData(imgHeight, imgWidth);

		var path_index = 0;
		var new_index = 0;
		
		for (var i=0; i < imgData.data.length/4; i+=1){
            if (path[path_index]+1 === i) {
            console.log('hi');
				path_index++;
				continue;
			}
			newImg.data[4*new_index] = imgData.data[4*i];
			newImg.data[4*new_index+1] = imgData.data[4*i+1];
			newImg.data[4*new_index+2] = imgData.data[4*i+2];
			newImg.data[4*new_index+3] = imgData.data[4*i+3];
			new_index++;
		}
        newImg = Filters.to_rowmajor(newImg, context);
        console.log(newImg);
        context.clearRect(0, 0, canvas.width, canvas.height);
		context.putImageData(newImg,0,0);
	};

});
