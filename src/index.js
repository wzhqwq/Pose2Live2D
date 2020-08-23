import "./styles.css";

import * as facemesh from "@tensorflow-models/facemesh";
import * as posenet from "@tensorflow-models/posenet";
import * as $ from "jquery";
import Stats from "stats.js";
import {Live2dCtrl} from "./live2d.ts";

window.$ = $;

function msg(m) {
  $('#message').html(m);
}
function err() {
  msg('<span style="color: #c00">Error occurred. Get details from DevTools.</span>');
}

var auto_pause = false, paused = false;
var show_landmarks = false, show_pose_net = true;
function update_options() {
  auto_pause = $('#isAutoPause').prop('checked');
  show_landmarks = $('#isShowLandmarks').prop('checked');
  show_pose_net = $('#isShowPoseNet').prop('checked');
}

const listen_range = (name, getFn) => {
  $(name).on('mouseup', () => getFn(parseFloat($(name).prop('value'))));
}

var stat = new Stats();
window.onload = () => {
  document.title = 'Pose2Live2D';
  $('#perf').append(stat.dom);
  stat.dom.style.position = 'initial';
  msg('Requesting for camera stream...');
  update_options();
  $('#options').on('click', () => update_options());
  start();
};

var video, landmark;
var faceModel, poseModel, live2dModel;
var models, model_now, param;
async function start() {
  video = await get_cam();
  landmark = document.getElementById('landmarks').getContext('2d');

  msg('Downloading Facemesh model...');
  faceModel = await facemesh.load(/*frames default*/5, /*confidence default*/0.9, /*max faces count*/1);
  msg('Downloading PoseNet model...');
  poseModel = await posenet.load({
    architecture: 'MobileNetV1',
    outputStride: 16,
    inputResolution: {width: 300, height: 400},
    multiplier: 0.75,
    quantBytes: 2,
    modelUrl: 'posenet/model-stride16.json'
  });
  await collect_data();
  start_live2d();
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
  msg('Loading camera...');
  return new Promise((res) => {
    video.onloadedmetadata = function () {
      video.play();
      res(video);
    }
  });
}

var minD, maxD;
const collect_data = () => {
  msg('Now we need to do a few facial expressions so that program could recognize your facial expression later. Click the button to start.');
  return new Promise(res => {
    var progress = 0;
    $('#next-btn').click(() => {
      switch (progress) {
        case 0:
          progress = 1;
          msg('Please open your mouth and eyes. Then click the button. You don\'t need to keep this pose during evaluation.');
          break;
        case 1:
          progress = -1;
          msg('Evaluating...');
          setTimeout(() => {
            faceModel.estimateFaces(video).then(p => {
              if (p.length == 0) {
                msg('No face detected. Please click the button to try again.');
                progress = 1;
                return;
              }
              var t = p[0].mesh;
              maxD = evaluate_face(t);
              msg('Okey. Please close your mouth and eyes. Then click the button.');
              progress = 2;
            });
          }, 0);
          break;
        case 2:
          progress = -1;
          msg('Evaluating...');
          setTimeout(() => {
            faceModel.estimateFaces(video).then(p => {
              if (p.length == 0) {
                msg('No face detected. Please click the button to try again.');
                progress = 2;
                return;
              }
              var t = p[0].mesh;
              minD = evaluate_face(t);
              msg(`${minD.toString()} _ ${maxD.toString()} Then click the button.`);
              progress = 3;
            });
          }, 0);
          break;
        case 3:
          $('#next-btn').css('display', 'none');
          res();
          break;
      }
    }).css('display', 'block');
  });
}

const start_live2d = () => {
  msg('Loading Live2D model...');
  var canvas = document.getElementById('live2d');
  var res;
  // Double happiness for Mac users
  if ((res = window.devicePixelRatio) != 1) {
    canvas.width = 600 * res;
    canvas.height = 600 * res;
    canvas.style.zoom = `${(1 / res).toFixed(3)}`;
  }
  live2dModel = new Live2dCtrl(canvas);

  $.getJSON('models/models.json', load_models);
};

async function load_models(res) {
  models = res.models;
  for (let i = 0; i < models.length; i++) {
    $('#models-list').append(`<ul><button id="model-${models[i]}" onclick="load_model('${models[i]}')">${models[i]}</button></ul>`);
  }
  await live2dModel.loadModel(model_now = models[0]);
  await new Promise(load_medium);
  $('#model-' + model_now).addClass('model-selected');
  $('#from-camera').css('margin-left', '-30px');
  msg('Live2D model loaded. Wait for a while...');
  setTimeout(async function () {
    await poseModel.estimateSinglePose(video, {
      flipHorizontal: true
    });
    cos_start();
  }, 300);
}

window.load_model = async function (name) {
  if (name == model_now) return;
  $('#model-' + model_now).removeClass('model-selected');
  $('#model-' + name).addClass('model-selected');
  pause();
  msg('Loading Live2D model... Model paused.');
  await live2dModel.loadModel(model_now = name);
  await new Promise(load_medium);
  msg('￣ω￣=');
  resume();
};

const load_medium = res => {
  $.getJSON(`medium/${model_now}.json`, resp => {
    setup_medium(resp);
    res();
  });
};
var changes = {};
const setup_medium = resp => {
  param = resp.param;
  msg('Setting up medium program');
  var controls = '';
  param.map(param => {
    controls += `<ul><span>${param.name}</span><input type="range" id="p-${param.name}" min="${param.min}" max="${param.max}" value="${param.default}" step="0.05"></ul>`;
  });
  $('#controls').html(controls);
  setTimeout(() => {
    param.map(param => 
      listen_range('#p-' + param.name, val => {
        changes[param.name] = val;
      })
    );
  });
};

const cos_start = () => {
  msg('￣ω￣=');
  window.onblur = () => {
    if (auto_pause) pause();
  };
  window.onfocus = () => {
    if (paused) resume();
  };
  stat.showPanel(0);
  stat.begin();
  calc();
};
// When changing model
const cos_end = () => {
  stat.end();
};

async function calc() {
  if (paused) return;
  stat.update();

  var blink_sync = false;
  const p1 = await faceModel.estimateFaces(video, false, true);
  const p2 = await poseModel.estimateSinglePose(video, {
    flipHorizontal: true
  });

  landmark.clearRect(0, 0, 300, 400);
  if (p2) {
    landmark.fillStyle = '#0000ff';
    let p = p2.keypoints;
    if (show_pose_net) {
      p.map(mark => {
        if (mark.score < 0.9) return;
        landmark.fillRect(mark.position.x, mark.position.y, 4, 4);
      });
    }
  }
  if (p1.length > 0 && p1[0].faceInViewConfidence > 0.9) {
    let p = p1[0];
    landmark.strokeStyle = '#ff0000';
    // p.scaledMesh.map(pos => {
    //   landmark.fillRect(pos[0], pos[1], 2, 2);
    // })
    if (show_landmarks) {
      let t = p.annotations;
      t.leftEyeLower0.map(pos => { landmark.fillRect(pos[0], pos[1], 2, 2); });
      t.rightEyeLower0.map(pos => { landmark.fillRect(pos[0], pos[1], 2, 2); });
      t.leftEyebrowLower.map(pos => { landmark.fillRect(pos[0], pos[1], 2, 2); });
      t.rightEyebrowLower.map(pos => { landmark.fillRect(pos[0], pos[1], 2, 2); });
      t.leftEyeUpper0.map(pos => { landmark.fillRect(pos[0], pos[1], 2, 2); });
      t.rightEyeUpper0.map(pos => { landmark.fillRect(pos[0], pos[1], 2, 2); });
      t.leftEyebrowUpper.map(pos => { landmark.fillRect(pos[0], pos[1], 2, 2); });
      t.rightEyebrowUpper.map(pos => { landmark.fillRect(pos[0], pos[1], 2, 2); });
      t.lipsUpperInner.map(pos => { landmark.fillRect(pos[0], pos[1], 2, 2); });
      t.lipsLowerInner.map(pos => { landmark.fillRect(pos[0], pos[1], 2, 2); });
      t.leftCheek.map(pos => { landmark.fillRect(pos[0], pos[1], 2, 2); });
      t.rightCheek.map(pos => { landmark.fillRect(pos[0], pos[1], 2, 2); });
    }
    if (p.scaledMesh[205][0] - p.scaledMesh[425][0] > 100) {
      blink_sync = true;
      let a = evaluate_face(p.mesh);
      // $('#aaa').html(`${a[0].toFixed(2)}(${((a[0] - minD[0]) / (maxD[0] - minD[0]) * 100).toFixed(0)}%) ` +
      //   `${a[1].toFixed(2)}(${((a[1] - minD[1]) / (maxD[1] - minD[1]) * 100).toFixed(0)}%) ` +
      //   `${a[2].toFixed(2)}(${((a[2] - minD[2]) / (maxD[2] - minD[2]) * 100).toFixed(0)}%)`);
      set_eyes((a[0] - minD[0]) / (maxD[0] - minD[0]), (a[1] - minD[1]) / (maxD[1] - minD[1]));
      set_mouth((a[2] - minD[2]) / (maxD[2] - minD[2]));
    }
    else {
      let a = evaluate_mouth(p.mesh);
      $('#aaa').html(`${a[0].toFixed(2)}(${((a[0] - minD[0]) / (maxD[0] - minD[0]) * 100).toFixed(0)}%)`);
      set_mouth((a[0] - minD[0]) / (maxD[0] - minD[0]));
    }
  }

  // live2dModel.update(changes, !blink_sync);
  changes = {};

  requestAnimationFrame(calc);
}

const mul = m => m * m;
const evaluate_face = t => {
  // left eye, right eye, mouth
  var l1 = t[386], l2 = t[374],
      r1 = t[159], r2 = t[145],
      m1 = t[13], m2 = t[14],
      p1 = t[10], p2 = t[9];
  var E2L = Math.sqrt(mul(p1[0] - p2[0]) + mul(p1[1] - p2[1]) + mul(p1[2] - p2[2]));
  return [
    Math.sqrt(mul(l1[0] - l2[0]) + mul(l1[1] - l2[1]) + mul(l1[2] - l2[2])) / E2L,
    Math.sqrt(mul(r1[0] - r2[0]) + mul(r1[1] - r2[1]) + mul(r1[2] - r2[2])) / E2L,
    Math.sqrt(mul(m1[0] - m2[0]) + mul(m1[1] - m2[1]) + mul(m1[2] - m2[2])) / E2L
  ];
};
const evaluate_mouth = t => {
  // mouth
  var m1 = t[13], m2 = t[14],
      p1 = t[10], p2 = t[9];
  var E2L = Math.sqrt(mul(p1[0] - p2[0]) + mul(p1[1] - p2[1]) + mul(p1[2] - p2[2]));
  return [Math.sqrt(mul(m1[0] - m2[0]) + mul(m1[1] - m2[1]) + mul(m1[2] - m2[2])) / E2L];
};
const evaluate_angle = t => {
  // angleX(x), angleY(z), angleZ(-y)
  // yaw-pitch-roll reverse:
  // You have: rx, rz: UnitVector
  // UnitVector extend Vector
  // const X, Y, Z: BaseVector
  // BaseVector extend UnitVector
  // Vector{x, y, z: number; R, project, dot, cross: Function}
  // Vector.R(axis: BaseVector, angle: number): Vector { return angle * this + (1 - angle) * this.dot(axis) * axis + Math.sqrt(1 - angle * angle) * axis.cross(this)}
  // Vector.project(axis_a: BaseVector, axis_b: BaseVector): UnitVector // Not so-called 'project'
  // Vector.dot(t: Vector): number
  // Vector.cross(t: Vector): Vector
  // cos(a: UnitVector, b: UnitVector): number { return a.dot(b) }
  // 1. t1 = rx.R(Y, y_r = cos(rx, rx.project(X, Y))) // x->X_Y
  // 2. t1 = t1.R(Z, z_r = cos(t1, X)) // x->X
  // 3. t2 = Y.R(Z, z_r)
  // 4. t3 = Z.R(t2, y_r)
  // 5. t3 = t3.R(X, x_r = cos(t2, rz)) // Z->z
  // Summary:
  // y_r = cos(rx, rx.project(X, Y))
  // x_r = cos(Z.R(Y.R(Z, z_r = cos(rx.R(Y, y_r), X)), y_r), rz)

  // Actually I(human precompiler) have: rx, rz: array<number>
  // const mul = t => t * t;
  // var rxpl = Math.sqrt(mul(rx[0]) + mul(rx[1]));
  // var y_r = mul(rx[0]) / rxpl + mul(rx[1]) / rxpl;
  // var z_r = y_r * rx[0] + Math.sqrt(1 - y_r * y_r) * rx[2];
  // var t1 = Math.sqrt(1 - y_r * y_r);
  // var t2 = -Math.sqrt(1 - z_r * z_r) * t1;
  // var x_r = z_r * t1 * rz[0] + t2 * rz[1] + (t2 + y_r) * rz[2];
  var p1 = t[10], p2 = t[9], p3 = t[108], p4 = t[337];
  return [];
}

const set_eyes = (left, right) => {
  changes[param[3].name] = left;
  changes[param[4].name] = right;
};
const set_mouth = p => {
  changes[param[5].name] = p;
};

const pause = () => {
  paused = true;
  document.title = 'video paused.';
  video.pause();
};
const resume = () => {
  paused = false;
  document.title = 'Pose2Live2D';
  video.play();
  calc();
};