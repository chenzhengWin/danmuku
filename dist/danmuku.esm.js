function warning (condition, message) {
  if (condition) return
  throw new Error(`Warning: ${message}`)
}
function callHook (hooks, name, args = []) {
  if (hooks && typeof hooks[name] === 'function') {
    hooks[name].apply(null, args);
  }
}
function createKey () {
  return Math.random()
    .toString(36)
    .substr(2, 8)
}
function toNumber (val) {
  return typeof val === 'number'
    ? val
    : typeof val === 'string'
      ? Number(val.replace('px', ''))
      : NaN
}
function lastElement (arr, lastIndex) {
  return arr[arr.length - lastIndex]
}
function isRange ([a, b], val) {
  if (val === a || val === b) return true
  const min = Math.min(a, b);
  const max = min === a ? b : a;
  return min < val && val < max
}
function upperCase ([first, ...remaing]) {
  return first.toUpperCase() + remaing.join('')
}
const raf = window.requestAnimationFrame
      ? window.requestAnimationFrame.bind(window)
      : setTimeout;
function nextFrame (fn) {
  raf(() => {
    raf(fn);
  });
}
let transitionProp = 'transition';
let transitionEndEvent = 'transitionend';
let transitionDuration = 'transitionDuration';
if (
    window.ontransitionend === undefined &&
    window.onwebkittransitionend !== undefined
) {
  transitionProp = 'WebkitTransition';
  transitionEndEvent = 'webkitTransitionEnd';
  transitionDuration = 'webkitTransitionDuration';
}
function whenTransitionEnds (node) {
  return new Promise(resolve => {
    let isCalled = false;
    const end = () => {
      node.removeEventListener(transitionEndEvent, onEnd);
      resolve();
    };
    const onEnd = () => {
      if (!isCalled) {
        isCalled = true;
        end();
      }
    };
    node.addEventListener(transitionEndEvent, onEnd);
  })
}

class Barrage {
  constructor (itemData, time, manager, hooks) {
    const RuntimeManager = manager.RuntimeManager;
    const { direction, container } = manager.opts;
    this.node = null;
    this.hooks = hooks;
    this.paused = false;
    this.moveing = false;
    this.data = itemData;
    this.duration = time;
    this.isSpecial = false;
    this.trajectory = null;
    this.manager = manager;
    this.direction = direction;
    this.container = container;
    this.RuntimeManager = RuntimeManager;
    this.key = itemData.key || createKey();
    this.position = {
      y: null,
    };
    this.timeInfo = {
      pauseTime: 0,
      startTime: null,
      prevPauseTime: null,
      currentDuration: time,
    };
    this.create();
  }
  getMovePrecent () {
    const { pauseTime, startTime, prevPauseTime } = this.timeInfo;
    const currentTime = this.paused ? prevPauseTime : Date.now();
    return (currentTime - startTime - pauseTime) / 1000 / this.duration
  }
  getMoveDistance (fix = true) {
    if (!this.moveing) return 0
    const percent = this.getMovePrecent();
    const containerWidth = this.RuntimeManager.containerWidth + (
      fix
        ? this.getWidth()
        : 0
    );
    return percent * containerWidth
  }
  getHeight () {
    return (this.node && this.node.clientHeight) || 0
  }
  getWidth () {
    return (this.node && this.node.clientWidth) || 0
  }
  getSpeed () {
    const duration = this.timeInfo.currentDuration;
    const containerWidth = this.RuntimeManager.containerWidth + this.getWidth();
    return duration == null || containerWidth == null
      ? 0
      : containerWidth / duration
  }
  create () {
    this.node = document.createElement('div');
    callHook(this.hooks, 'barrageCreate', [this.node, this]);
  }
  append () {
    warning(this.container, 'Need container element.');
    if (this.node) {
      this.container.appendChild(this.node);
      callHook(this.hooks, 'barrageAppend', [this.node, this]);
    }
  }
  remove (noCallHook) {
    warning(this.container, 'Need container element.');
    if (this.node) {
      this.container.removeChild(this.node);
      if (!noCallHook) {
        callHook(this.hooks, 'barrageRemove', [this.node, this]);
      }
    }
  }
  deletedInMemory () {
    let index = -1;
    const trajectory = this.trajectory;
    const showBarrages = this.manager.showBarrages;
    if (trajectory && trajectory.values.length > 0) {
      index = trajectory.values.indexOf(this);
      if (~index) trajectory.values.splice(index, 1);
    }
    if (showBarrages && showBarrages.length > 0) {
      index = showBarrages.indexOf(this);
      if (~index) showBarrages.splice(index, 1);
    }
  }
  destroy () {
    this.remove();
    this.moveing = false;
    this.deletedInMemory();
    callHook(this.hooks, 'barrageDestroy', [this.node, this]);
    this.node = null;
  }
  pause () {
    if (this.moveing && !this.paused) {
      let moveDistance = this.getMoveDistance();
      if (!Number.isNaN(moveDistance)) {
        this.paused = true;
        this.timeInfo.prevPauseTime = Date.now();
        if (this.direction === 'right') {
          moveDistance *= -1;
        }
        this.node.style[transitionDuration] = '0s';
        this.node.style.transform = `translateX(${moveDistance}px)`;
      }
    }
  }
  resume () {
    if (this.moveing && this.paused) {
      this.paused = false;
      this.timeInfo.pauseTime += Date.now() - this.timeInfo.prevPauseTime;
      this.timeInfo.prevPauseTime = null;
      const des = this.direction === 'left' ? 1 : -1;
      const containerWidth = this.RuntimeManager.containerWidth + this.getWidth();
      const remainingTime = (1 - this.getMoveDistance() / containerWidth) * this.duration;
      this.timeInfo.currentDuration = remainingTime;
      this.node.style[transitionDuration] = `${remainingTime}s`;
      this.node.style.transform = `translateX(${containerWidth * des}px)`;
    }
  }
  reset () {
    this.paused = false;
    this.moveing = false;
    this.trajectory = null;
    this.position = {
      y: null,
    };
    this.timeInfo = {
      pauseTime: 0,
      startTime: null,
      prevPauseTime: null,
      currentDuration: this.duration,
    };
    this.remove(true);
    this.deletedInMemory();
  }
}

class RuntimeManager {
  constructor (opts) {
    const {container, rowGap, height} = opts;
    const styles = getComputedStyle(container);
    if (!styles.position || styles.position === 'static') {
      container.style.position = 'relative';
    }
    this.opts = opts;
    this.rowGap = rowGap;
    this.singleHeight = height;
    this.containerElement = container;
    this.containerWidth = toNumber(styles.width);
    this.containerHeight = toNumber(styles.height);
    this.init();
  }
  init () {
    this.container = [];
    this.rows = parseInt(this.containerHeight / this.singleHeight);
    for (let i = 0; i < this.rows; i++) {
      const start = this.singleHeight * i;
      const end = this.singleHeight * (i + 1) - 1;
      this.container.push({
        values: [],
        gaps: [start, end],
      });
    }
  }
  resize () {
    const styles = getComputedStyle(this.containerElement);
    this.containerWidth = toNumber(styles.width);
    this.containerHeight = toNumber(styles.height);
    this.rows = parseInt(this.containerHeight / this.singleHeight);
    const container = [];
    for (let i = 0; i < this.rows; i++) {
      const start = this.singleHeight * i;
      const end = this.singleHeight * (i + 1) - 1;
      const gaps = [start, end];
      if (this.container[i]) {
        this.container[i].gaps = gaps;
        container.push(this.container[i]);
      } else {
        container.push({ gaps, values: [] });
      }
    }
    this.container = container;
  }
  getRandomIndex (exclude) {
    const randomIndex = Math.floor(Math.random() * this.rows);
    return exclude.includes(randomIndex)
      ? this.getRandomIndex(exclude)
      : randomIndex
  }
  getTrajectory (alreadyFound = []) {
    if (alreadyFound.length === this.container.length) {
      return null
    }
    const index = this.getRandomIndex(alreadyFound);
    const currentTrajectory = this.container[index];
    const lastBarrage = lastElement(currentTrajectory.values, 1);
    if (this.rowGap <= 0 || !lastBarrage) {
      return currentTrajectory
    }
    alreadyFound.push(index);
    if (lastBarrage.moveing) {
      const distance = lastBarrage.getMoveDistance();
      const spacing = this.rowGap > 0
        ? this.rowGap + lastBarrage.getWidth()
        : this.rowGap;
      return distance > spacing
        ? currentTrajectory
        : this.getTrajectory(alreadyFound)
    }
    return this.getTrajectory(alreadyFound)
  }
  computingDuration (prevBarrage, currentBarrage) {
    const prevWidth = prevBarrage.getWidth();
    const currentWidth = currentBarrage.getWidth();
    const prevSpeed = prevBarrage.getSpeed();
    const currentSpeed = currentBarrage.getSpeed();
    const acceleration = currentSpeed - prevSpeed;
    if (acceleration <= 0) {
      return null
    }
    const distance = prevBarrage.getMoveDistance(false);
    const meetTime = distance / acceleration;
    if (meetTime >= currentBarrage.duration) {
      return null
    }
    const containerWidth = this.containerWidth + currentWidth + prevWidth;
    const remainingTime = (1 - prevBarrage.getMovePrecent()) * prevBarrage.duration;
    return containerWidth * remainingTime / this.containerWidth
  }
  move (barrage, manager) {
    const node = barrage.node;
    const prevBarrage = lastElement(barrage.trajectory.values, 2);
    node.style.top = `${barrage.position.y}px`;
    return new Promise(resolve => {
      nextFrame(() => {
        const width = barrage.getWidth();
        const des = barrage.direction === 'left' ? 1 : -1;
        const containerWidth = this.containerWidth + width;
        if (
            prevBarrage &&
            this.rowGap > 0 &&
            prevBarrage.moveing &&
            !prevBarrage.paused
        ) {
          const fixTime = this.computingDuration(prevBarrage, barrage);
          if (fixTime !== null) {
            if (isRange(this.opts.times, fixTime)) {
              barrage.duration = fixTime;
              barrage.timeInfo.currentDuration = fixTime;
            } else {
              barrage.reset();
              node.style.top = null;
              manager.stashBarrages.unshift(barrage);
              return
            }
          }
        }
        node.style.opacity = 1;
        node.style.pointerEvents = manager.isShow ? 'auto' : 'none';
        node.style.visibility = manager.isShow ? 'visible' : 'hidden';
        node.style.transform = `translateX(${des * (containerWidth)}px)`;
        node.style[transitionProp] = `transform linear ${barrage.duration}s`;
        node.style[`margin${upperCase(barrage.direction)}`] = `-${width}px`;
        barrage.moveing = true;
        barrage.timeInfo.startTime = Date.now();
        callHook(barrage.hooks, 'barrageMove', [node, barrage]);
        resolve(whenTransitionEnds(node));
      });
    })
  }
  moveSpecialBarrage (barrage, manager) {
    const { node, opts } = barrage;
    node.style.position = 'absolute';
    node.style.display = 'inline-block';
    node.style.pointerEvents = manager.isShow ? 'auto' : 'none';
    node.style.visibility = manager.isShow ? 'visible' : 'hidden';
    return new Promise(resolve => {
      const { x = 0, y = 0 } = opts.position(barrage);
      this.moveing = true;
      callHook(manager.opts.hooks, 'barrageMove', [barrage.node, barrage]);
      const xStyle = `translateX(${x})`;
      const yStyle = `translateY(${y})`;
      node.style.transform = xStyle + yStyle;
      if (opts.direction === 'none') {
        setTimeout(resolve, opts.duration);
      } else {
        nextFrame(() => {
          const des = opts.direction === 'left' ? 1 : -1;
          node.style.transform = `translateX(${des * (this.containerWidth)}px) ${yStyle}`;
          node.style[transitionProp] = `transform linear ${opts.duration}s`;
          resolve(whenTransitionEnds(node));
        });
      }
    })
  }
}

class SpecialBarrage {
  constructor (opts) {
    this.opts = opts;
    this.node = null;
    this.moveing = false;
    this.isSpecial = true;
    this.hooks = opts.hooks;
    this.data = opts.data || null;
    this.key = opts.key || createKey();
    this.timeInfo = {
      pauseTime: 0,
      startTime: null,
      prevPauseTime: null,
      currentDuration: opts.duration,
    };
  }
  getHeight () {
    return (this.node && this.node.clientHeight) || 0
  }
  getWidth () {
    return (this.node && this.node.clientWidth) || 0
  }
  create (manager) {
    this.node = document.createElement('div');
    callHook(this.hooks, 'create', [this.node, this]);
    callHook(manager.opts.hooks, 'barrageCreate', [this.node, this]);
  }
  getMovePrecent () {
    const { pauseTime, startTime, prevPauseTime } = this.timeInfo;
    const currentTime = this.paused ? prevPauseTime : Date.now();
    return (currentTime - startTime - pauseTime) / 1000 / this.duration
  }
  append (manager) {
    warning(manager.container, 'Need container element.');
    if (this.node) {
      manager.container.appendChild(this.node);
      callHook(this.hooks, 'append', [this.node, this]);
      callHook(manager.opts.hooks, 'barrageAppend', [this.node, this]);
    }
  }
  remove (manager) {
    warning(manager.container, 'Need container element.');
    if (this.node) {
      manager.container.removeChild(this.node);
      callHook(this.hooks, 'remove', [this.node, this]);
      callHook(manager.opts.hooks, 'barrageRemove', [this.node, this]);
    }
  }
  destroy (manager) {
    this.remove(manager);
    this.moveing = false;
    const index = manager.specialBarrages.indexOf(this);
    if (~index) {
      manager.specialBarrages.splice(index, 1);
    }
    callHook(this.hooks, 'destroy', [this.node, this]);
    callHook(manager.opts.hooks, 'barrageDestroy', [this.node, this]);
    this.node = null;
  }
}
function createSpecialBarrage (opts = {}) {
  opts = Object.assign({
    hooks: {},
    duration: 0,
    direction: 'none',
    position: () => ({ x: 0, y: 0 }),
  }, opts);
  return new SpecialBarrage(opts)
}

class BarrageManager {
  constructor (opts) {
    this.opts = opts;
    this.loopTimer = null;
    this.showBarrages = [];
    this.stashBarrages = [];
    this.specialBarrages = [];
    this.isShow = opts.isShow;
    this.container = opts.container;
    this.RuntimeManager = new RuntimeManager(opts);
  }
  get stashLength () {
    return this.stashBarrages.length
  }
  get specialLength () {
    return this.specialBarrages.length
  }
  get showLength () {
    return this.showBarrages.length + this.specialBarrages.length
  }
  get length () {
    return this.showBarrages.length + this.specialBarrages.length + this.stashBarrages.length
  }
  get containerWidth () {
    return this.RuntimeManager.containerWidth
  }
  get containerHeight () {
    return this.RuntimeManager.containerHeight
  }
  get runing () {
    return this.loopTimer !== null
  }
  send (data) {
    if (!Array.isArray(data)) data = [data];
    if (this.assertCapacity(data.length)) return false
    this.stashBarrages.push.apply(this.stashBarrages, data);
    callHook(this.opts.hooks, 'send', [this, data]);
    return true
  }
  sendSpecial (data) {
    if (!this.runing) return false
    if (!Array.isArray(data)) data = [data];
    if (this.assertCapacity(data.length)) return false
    for (let i = 0; i < data.length; i++) {
      const barrage =  createSpecialBarrage(data[i]);
      if (barrage.opts.duration <= 0) continue
      barrage.create(this);
      barrage.append(this);
      this.specialBarrages.push(barrage);
      this.RuntimeManager.moveSpecialBarrage(barrage, this).then(() => {
        barrage.destroy(this);
        if (this.length === 0) {
          callHook(this.opts.hooks, 'ended', [this]);
        }
      });
    }
    callHook(this.opts.hooks, 'sendSpecial', [this, data]);
    return true
  }
  show () {
    if (!this.isShow) {
      this.isShow = true;
      this.each(barrage => {
        if (barrage.node) {
          barrage.node.style.visibility = 'visible';
          barrage.node.style.pointerEvents = 'auto';
        }
      });
      callHook(this.opts.hooks, 'show', [this]);
    }
    return this
  }
  hidden () {
    if (this.isShow) {
      this.isShow = false;
      this.each(barrage => {
        if (barrage.node) {
          barrage.node.style.visibility = 'hidden';
          barrage.node.style.pointerEvents = 'none';
        }
      });
      callHook(this.opts.hooks, 'hidden', [this]);
    }
    return this
  }
  each (cb) {
    if (typeof cb === 'function') {
      let i = 0;
      for (; i < this.specialBarrages.length; i++) {
        cb(this.specialBarrages[i], i);
      }
      for (i = 0; i < this.showBarrages.length; i++) {
        const barrage = this.showBarrages[i];
        if (barrage.moveing) {
          cb(barrage, i);
        }
      }
    }
    return this
  }
  stop (noCallHook) {
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
      if (!noCallHook) {
        callHook(this.opts.hooks, 'stop', [this]);
      }
    }
    return this
  }
  start (noCallHook) {
    const core = () => {
      this.loopTimer = setTimeout(() => {
        this.renderBarrage();
        core();
      }, this.opts.interval);
    };
    this.stop(true);
    core();
    if (!noCallHook) {
      callHook(this.opts.hooks, 'start', [this]);
    }
    return this
  }
  setOptions (opts) {
    if (opts) {
      if ('interval' in opts) {
        this.stop(true);
        this.start(true);
      }
      if ('height' in opts) {
        this.RuntimeManager.singleHeight = opts.height;
        this.RuntimeManager.resize();
      }
      if ('rowGap' in opts) {
        this.RuntimeManager.rowGap = opts.rowGap;
      }
      this.opts = Object.assign(this.opts, opts);
      callHook(this.opts.hooks, 'setOptions', [this, opts]);
    }
    return this
  }
  resize () {
    this.RuntimeManager.resize();
    callHook(this.opts.hooks, 'resize', [this]);
    return this
  }
  clear () {
    this.stop();
    this.each(barrage => {
      barrage.isSpecial
        ? barrage.remove(this)
        : barrage.remove();
    });
    this.showBarrages = [];
    this.stashBarrages = [];
    this.specialBarrages = [];
    this.RuntimeManager.container = [];
    this.RuntimeManager.resize();
    callHook(this.opts.hooks, 'clear', [this]);
  }
  assertCapacity (n) {
    const res = n + this.length > this.opts.capacity;
    if (res) {
      console.warn(`The number of barrage is greater than "${this.opts.capacity}".`);
    }
    return res
  }
  renderBarrage () {
    if (this.stashBarrages.length > 0) {
      const { rows, rowGap } = this.RuntimeManager;
      let length = this.opts.limit - this.showLength;
      if (rowGap > 0 && length > rows) {
        length = this.RuntimeManager.rows;
      }
      if (length > this.stashBarrages.length) {
        length = this.stashBarrages.length;
      }
      if (length > 0 && this.runing) {
        for (let i = 0; i < length; i++) {
          const data = this.stashBarrages.shift();
          if (data) {
            this.initSingleBarrage(data);
          }
        }
        callHook(this.opts.hooks, 'render', [this]);
      }
    }
  }
  initSingleBarrage (data) {
    const barrage = data instanceof Barrage ? data : this.createSingleBarrage(data);
    const newBarrage = barrage && this.sureBarrageInfo(barrage);
    if (newBarrage) {
      newBarrage.append();
      this.showBarrages.push(newBarrage);
      newBarrage.trajectory.values.push(newBarrage);
      this.RuntimeManager.move(newBarrage, this).then(() => {
        newBarrage.destroy();
        if (this.length === 0) {
          callHook(this.opts.hooks, 'ended', [this]);
        }
      });
    } else {
      this.stashBarrages.unshift(barrage);
    }
  }
  createSingleBarrage (data) {
    const [max, min] = this.opts.times;
    const time = Number(
      max === min
        ? max
        : (Math.random() * (max - min) + min).toFixed(0)
    );
    if (time <= 0) return null
    return new Barrage(
      data,
      time,
      this,
      Object.assign({}, this.opts.hooks, {
        barrageCreate: this.setBarrageStyle.bind(this),
      })
    )
  }
  sureBarrageInfo (barrage) {
    const trajectory = this.RuntimeManager.getTrajectory();
    if (!trajectory) return null
    barrage.trajectory = trajectory;
    barrage.position.y = trajectory.gaps[0];
    return barrage
  }
  setBarrageStyle (node, barrage) {
    const { hooks = {}, direction } = this.opts;
    callHook(hooks, 'barrageCreate', [node, barrage]);
    node.style.opacity = 0;
    node.style[direction] = 0;
    node.style.position = 'absolute';
    node.style.display = 'inline-block';
    node.style.pointerEvents = this.isShow ? 'auto' : 'none';
    node.style.visibility = this.isShow ? 'visible' : 'hidden';
  }
}

function createBarrageManager (opts = {}) {
  opts = Object.assign({
    hooks: {},
    limit: 50,
    height: 50,
    rowGap: 50,
    isShow: true,
    capacity: 1024,
    times: [8, 15],
    interval: 2000,
    direction: 'right',
  }, opts);
  return new BarrageManager(opts)
}
var index = {
  create: createBarrageManager,
};

export default index;