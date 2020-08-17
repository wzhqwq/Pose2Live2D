import "./styles.css";

import * as facemesh from "@tensorflow-models/facemesh";
import * as posenet from "@tensorflow-models/posenet";
import * as $ from "jquery";

window.$ = $;

function msg(m) {
  $('#status').html(m);
}
function err() {
  msg('<span style="color: #c00">Error occurred. Get details from DevTools.</span>');
}

window.onload = () => {
  document.title = 'Pose2Live2D';
  msg('Requesting for camera stream...');
  start();
};

var auto_pause = false, paused = false;
var show_key_points = false, show_pose_net = false;
function update_options() {
  auto_pause = $('#isAutoPause').prop('checked');
  show_key_points = $('#isShowKeyPoints').prop('checked');
  show_pose_net = $('#isShowPoseNet').prop('checked');
}

var video;
var faceModel, poseModel;
async function start() {
  video = await get_cam();

  update_options();
  $('#options').on('click', () => { update_options(); });
  window.onblur = () => {
    if (auto_pause) pause();
  };
  window.onfocus = () => {
    if (paused) resume();
  };

  msg('Downloading Facemesh model...');
  faceModel = await facemesh.load(/*frames default*/5, /*confidence default*/0.9, /*max faces count*/1);
  msg('Downloading PoseNet model...');
  poseModel = await posenet.load({
    architecture: 'MobileNetV1',
    outputStride: 16,
    inputResolution: {width: 300, height: 400},
    multiplier: 0.75,
    quantBytes: 2
  });

  msg('Loading Live2D model...');
}

async function get_cam() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    err();
    throw new Error('navigator.medisDevices.getUserMedia is not supported.');
  }
  var video = document.getElementById('from-camera');
  try {
    video.srcObject = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: 300,
        height: 400
      }
    });
  }
  catch (e) {
    err();
    throw e;
  }
  msg('loading camera...');
  return new Promise((res) => {
    video.onloadedmetadata = function () {
      video.play();
      res(video);
    }
  });
}

function pause() {
  paused = true;
  document.title = 'video paused.';
  video.pause();
}
function resume() {
  paused = false;
  document.title = 'Pose2Live2D';
  video.play();
}