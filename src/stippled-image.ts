import { workerScript } from './worker';

function fire(element: HTMLElement, name: string, detail?: any) {
  element.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
}

export class StippledImage extends HTMLElement {
  private root: ShadowRoot;
  private canvasElement?: HTMLCanvasElement;

  private _w?: number;
  private _h?: number;
  private _src = '';
  private _n = 0;
  private _i?: HTMLImageElement;
  private _r = 3;
  private _c = '#000000';
  private _sampling = 50;

  private worker?: Worker;
  private _workerUrl?: string;
  private stippleData?: Float32Array;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    this.root.innerHTML = `
    <style>
      :host {
        display: inline-block;
        overflow: hidden;
      }
      canvas {
        display: block;
      }
    </style>
    <canvas></canvas>
    `;
  }

  static get observedAttributes() {
    return [
      'width',
      'height',
      'src',
      'points',
      'color',
      'radius',
      'sampling'
    ]
  }

  attributeChangedCallback(name: string, _: string, newValue: string) {
    switch (name) {
      case 'width':
        this.width = +newValue;
        break;
      case 'height':
        this.height = +newValue;
        break;
      case 'points':
        this.points = +newValue;
        break;
      case 'src':
        this.src = newValue;
        break;
      case 'radius':
        this.radius = +newValue;
        break;
      case 'color':
        this.color = newValue;
        break;
      case 'sampling':
        this.sampling = +newValue;
        break;
    }
  }

  connectedCallback() {
    this.refresh();
  }

  disconnectedCallback() {
    this.terminateWorker();
    if (this._workerUrl) {
      URL.revokeObjectURL(this._workerUrl);
      this._workerUrl = undefined;
    }
  }

  private get workerUrl(): string {
    if (!this._workerUrl) {
      const blob = new Blob([workerScript], {
        type: 'text/javascript'
      });
      this._workerUrl = URL.createObjectURL(blob);
    }
    return this._workerUrl;
  }

  private get canvas(): HTMLCanvasElement {
    if (!this.canvasElement) {
      this.canvasElement = this.root.querySelector('canvas')!;
    }
    return this.canvasElement;
  }

  get width(): number {
    return this._w || (this._i && this._i.width) || 0;
  }

  get height(): number {
    return this._h || (this._i && this._i.height) || 0;
  }

  set width(value: number) {
    if (this._w !== value) {
      this._w = value;
      this.refresh();
    }
  }

  set height(value: number) {
    if (this._h !== value) {
      this._h = value;
      this.refresh();
    }
  }

  get points(): number {
    return Math.min(20000, this._n || (this.width * this.height) / this.sampling);
  }

  set points(value: number) {
    value = Math.min(20000, value);
    if (this._n !== value) {
      this._n = value;
      this.refresh();
    }
  }

  get src(): string {
    return this._src;
  }

  set src(value: string) {
    if (this._src !== value) {
      this._src = value;
      this.refresh();
    }
  }

  get color(): string {
    return this._c;
  }

  set color(value: string) {
    if (this._c !== value) {
      this._c = value;
      this.draw();
    }
  }

  get radius(): number {
    return this._r;
  }

  set radius(value: number) {
    if (this._r !== value) {
      this._r = value;
      this.draw();
    }
  }

  get sampling(): number {
    return this._sampling;
  }

  set sampling(value: number) {
    if (this._sampling !== value) {
      this._sampling = value;
      this.refresh();
    }
  }

  private refreshing = false;
  private refresh() {
    if (!this.refreshing) {
      this.refreshing = true;
      this.doRefresh()
        .then(() => this.refreshing = false)
        .catch(() => this.refreshing = false);
    }
  }

  private async doRefresh() {
    // terminate worker
    this.terminateWorker();
    if (!this._src) {
      return;
    }

    // fetch image and get data
    const image = this._i = await this.loadImage(this._src);
    const { width, height } = this;
    const ctx = this.createContext([width, height]);
    ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);

    // resize canvas
    this.canvas.width = width;
    this.canvas.height = height;

    // Create worker
    this.worker = new Worker(this.workerUrl);
    this.worker.addEventListener('message', this.messageHandler);
    this.worker.postMessage({
      buffer: imageData.data.buffer,
      width,
      height,
      pointCount: this.points
    }, [imageData.data.buffer]);
  }

  private async loadImage(url: string): Promise<HTMLImageElement> {
    if (this._i && this._i.src === url) {
      return this._i;
    }
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject();
      image.onabort = () => reject();
      image.src = url;
    });
  }

  private createContext(size: [number, number]) {
    const canvas = ('OffscreenCanvas' in window) ? new OffscreenCanvas(size[0], size[1]) : document.createElement('canvas');
    canvas.width = size[0];
    canvas.height = size[1];
    return canvas.getContext('2d')!;
  }

  private messageHandler: EventListener = (event: Event) => {
    if (this.worker) {
      const { points, iteration } = (event as MessageEvent).data;
      this.stippleData = points;
      this.draw();
      if (iteration === 50) {
        const worker = this.worker;
        setTimeout(() => {
          if (worker === this.worker) {
            this.terminateWorker();
          }
        });
      }
      fire(this, iteration === 50 ? 'load' : 'render');
    }
  };

  private terminateWorker() {
    if (this.worker) {
      this.worker.removeEventListener('message', this.messageHandler);
      try {
        this.worker.terminate();
      } catch (err) {
        console.log(err);
      }
      this.worker = undefined;
    }
  }

  private draw() {
    const canvas = this.canvas;
    if (canvas) {
      const ctx = this.canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!this.stippleData) {
        return;
      }
      ctx.fillStyle = this.color;
      ctx.beginPath();
      for (let i = 0; i < (this.stippleData.length - 1); i += 2) {
        const x = this.stippleData[i];
        const y = this.stippleData[i + 1];
        ctx.moveTo(x, y);
        ctx.arc(x, y, this.radius, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.closePath();
    }
  }
}

customElements.define('stippled-image', StippledImage);