# Pose2Live2D
This project is inspired from PoseAnimator.
(才发现早就有同类软件了，但我还要把它完成)

## My changes to third party resources

- One of official source codes of Live2D(rendering/cubismrenderer_webgl.ts) is modified due to build errors caused by code bugs(TypeErrors).

- One of official source codes of Live2D(effect/cubismbreath.ts) is modified(add -> set) because I can't understand why it add values to breath percentage by frames.

- Live2D models is collected from web, but I removed their motion files and background image to minimize the project size.

- I modified the URLs of three tensorflow models to boost download speed in China.

## About facemesh and blazeface

修改后的站点是我唯一可以获取以上两个模型的地方了, 然而他们的版本不被最新的包(0.0.4)所支持, 会报错, 故facemesh包用的是0.0.1

话说Iris模型在哪可以用啊，能检测眼球就更好了

## Drawbacks

Facemesh model(0.0.1) can't recognize closed eyes, so when you are a little far from camera(when you are posing), it won't respond to your eyes blink. Maybe the version of facemesh model is too old(0.0.1 -> 0.0.4). However, I can't download latest tensorflow model even I have the codes. qwq

## Get started
### Build

To install dependencies and generate main.js:

```bash
npm install
npm start build
```
### Run

To run project on http server:

```bash
npm start run
```

## Now support:

- Blink
- Mouth open

## Will be supported in the future

- Pose

- Brow

- Eye balls

- Smile (mouth, eyes)

- Scared face detect