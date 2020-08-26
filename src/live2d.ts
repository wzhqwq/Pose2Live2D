// classes
import {Live2DCubismFramework as Live2d, Option, LogLevel} from '@live2d/live2dcubismframework';
import {Live2DCubismFramework as Live2dSetting} from '@live2d/icubismmodelsetting';
import {Live2DCubismFramework as Live2dUserModel} from '@live2d/model/cubismusermodel';
import {Live2DCubismFramework as Live2dSettingJson} from '@live2d/cubismmodelsettingjson';
import {Live2DCubismFramework as Live2dMatrix} from '@live2d/math/cubismmatrix44';
import {Live2DCubismFramework as Live2dModelMatrix} from '@live2d/math/cubismmodelmatrix';
import {Live2DCubismFramework as Live2dPose} from '@live2d/effect/cubismpose';
import {Live2DCubismFramework as Live2dBreath} from '@live2d/effect/cubismbreath';
import {Live2DCubismFramework as Live2dBlink} from '@live2d/effect/cubismeyeblink';
import {Live2DCubismFramework as Live2dVector} from '@live2d/type/csmvector';

// classes
import Cubism = Live2d.CubismFramework;
import Setting = Live2dSetting.ICubismModelSetting;
import SettingJson = Live2dSettingJson.CubismModelSettingJson;
import UserModel = Live2dUserModel.CubismUserModel;
import Matrix = Live2dMatrix.CubismMatrix44;
import ModelMatrix = Live2dModelMatrix.CubismModelMatrix;
import Pose = Live2dPose.CubismPose;
import Breath = Live2dBreath.CubismBreath;
import BreathData = Live2dBreath.BreathParameterData;
import Blink = Live2dBlink.CubismEyeBlink;
import Vector = Live2dVector.csmVector;


function msg(m: string): void {
  console.log(m);
}

class Model extends UserModel {
  private _baseurl: string;
  private _setting: Setting;
  gl: WebGLRenderingContext;
  size: number;

  public loadURL(path: string): Promise<void> {
    this._baseurl = path.slice(0, path.lastIndexOf('/') + 1);
    return new Promise((res) => {
      fetch(path)
      .then(resp => resp.arrayBuffer())
      .then(buf => {
        this._setting = new SettingJson(buf, buf.byteLength);
        this._setModel().then(() => res());
      });
    });
  }

  private _setModel() {
    return new Promise((res) => {
      fetch(this._baseurl + this._setting.getModelFileName())
      .then(resp => resp.arrayBuffer())
      .then(buf => {
        this.loadModel(buf);
        this._breath = Breath.create();
        let breaths: Vector<BreathData> = new Vector(1);
        breaths.pushBack(new BreathData(Cubism.getIdManager().getId('ParamBreath'), 0.5, 0.5, 4, 1));
        this._breath.setParameters(breaths);
        this._eyeBlink = Blink.create(this._setting);
        this._eyeBlink.setBlinkingInterval(3.0);
        this._eyeBlink.setBlinkingSetting(0.2, 0.05, 0.2);
        if (this._setting.getPoseFileName())
          loadPose();
        else
          loadPhysics();
      });

      const loadPose = (): void => {
        fetch(this._baseurl + this._setting.getPoseFileName())
        .then(resp => resp.arrayBuffer())
        .then(buf => {
          this._pose = Pose.create(buf, buf.byteLength);
          this._pose.updateParameters(this._model, 0);
          loadPhysics();
        })
      }
  
      const loadPhysics = (): void => {
        fetch(this._baseurl + this._setting.getPhysicsFileName())
        .then(resp => resp.arrayBuffer())
        .then(buf => {
          this.loadPhysics(buf, buf.byteLength);
          loadRenderer();
        });
        // for (var i = 0; i < this._model.getParameterCount(); i++)
        //   console.log(i, this._model.getParameterDefaultValue(i), this._model.getParameterMinimumValue(i), this._model.getParameterMaximumValue(i));
      }
  
      const loadRenderer = ():void => {
        let gl = this.gl;
        this.createRenderer();
        this.getRenderer().startUp(gl);
        this.getRenderer().setRenderState(gl.getParameter(gl.FRAMEBUFFER_BINDING), [0, 0, this.size, this.size]);

        let modelM: ModelMatrix = new ModelMatrix(this._model.getCanvasWidth(), this._model.getCanvasHeight());
        let projM: Matrix = new Matrix();
        projM.scale(2, 2);
        projM.multiplyByMatrix(modelM);
        this.getRenderer().setMvpMatrix(projM);
        
        let p:Array<Promise<void>> = new Array();
        for (let i = this._setting.getTextureCount() - 1; i >= 0; i--) {
          let texture: HTMLImageElement = new Image();
          p.push(new Promise(res => {
            texture.onload = () => {
              const tex: WebGLTexture = gl.createTexture();
              
              gl.bindTexture(gl.TEXTURE_2D, tex);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
              gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
              gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture);
              gl.generateMipmap(gl.TEXTURE_2D);
              this.getRenderer().bindTexture(i, tex);
              res();
            };
          }));
          texture.src = this._baseurl + this._setting.getTextureFileName(i);
        }
        Promise.all(p).then(() => {
          this.getRenderer().setIsPremultipliedAlpha(true);
          res();
        });
      };
    });
  }

  public setPara(name: string, value: number) {
    this._model.setParameterValueById(Cubism.getIdManager().getId(name), value, 0.8);
    // 第三个参数 权重 是实现缓动的, 在绑定中可以减少突变造成的影响
  }
  public setParaIm(name: string, value: number) {
    this._model.setParameterValueById(Cubism.getIdManager().getId(name), value);
  }

  public update(delta: number, auto_blink: boolean) {
    this._physics.evaluate(this._model, delta);
    this._breath.updateParameters(this._model, delta);
    if (auto_blink) this._eyeBlink.updateParameters(this._model, delta);
    this._model.update();
    this.getRenderer().drawModel();
  }
}

export class Live2dCtrl {
  private _models: Map<string, Model>;
  private _model: Model;
  private _lastTime: number = 0;
  private _gl: WebGLRenderingContext;
  private _size: number;

  constructor(canvas: HTMLCanvasElement) {
    let opt: Option = new Option();
    opt.logFunction = msg;
    opt.loggingLevel = LogLevel.LogLevel_Verbose;

    Cubism.startUp(opt);
    Cubism.initialize();

    this._models = new Map();
    this._gl = canvas.getContext('webgl');
    this._size = canvas.width;
  }

  public loadModel(name: string): Promise<void> {
    return new Promise(res => {
      if (this._models.has(name)) {
        this._model = this._models.get(name);
        res();
      } else {
        this._models.set(name, (this._model = new Model()));
        this._model.gl = this._gl;
        this._model.size = this._size;
        this._model.loadURL(`models/${name}/${name}.model3.json`)
        .then(() => res());
      }
    });
  }

  public update(changes: Object, auto_blink: boolean) {
    let delta: number;
    let now: number = Date.now();
    if (!this._lastTime)
      delta = 0;
    else
      delta = (now - this._lastTime) / 1000;
    this._lastTime = now;

    for (var param in changes)
      if (!(changes[param] instanceof Object))
        this._model.setPara(param, changes[param]);

    this._model.update(delta, auto_blink);
  }
}