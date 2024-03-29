import {
  Simulation,
  Square,
  Vector,
  Color,
  SimulationElement,
  frameLoop,
  Line,
  Circle,
  distance,
  clamp
} from 'simulationjs';
import { debounce } from 'lodash';

declare global {
  interface Window {
    addProbability: () => void;
    toggleRemoveProbability: () => void;
    updateUiProbabilities: () => void;
    handleImportValues: () => void;
    toggleImportInput: () => void;
    toggleExportValues: () => void;
  }
}

const canvas = new Simulation('canvas');
canvas.fitElement();

const height = window.innerHeight * 0.48192771084;
const width = height * 1.75;

class Text extends SimulationElement {
  text: string;
  size: number;
  ratio = 1;
  constructor(pos: Vector, text: string, size: number, ratio: number, color = new Color(0, 0, 0)) {
    super(pos, color, 'text' as any);
    this.ratio = ratio;
    this.size = size;
    this.text = text;
  }
  draw(c: CanvasRenderingContext2D) {
    c.beginPath();
    const size = this.size * this.ratio;
    c.font = `${size}px arial`;
    c.fillStyle = this.color.toHex();
    c.fillText(this.text, this.pos.x, this.pos.y);
    c.closePath();
  }
  setText(text: string) {
    this.text = text;
  }
}

const box = new Square(
  new Vector(canvas.width / 2, canvas.height / 2),
  width,
  height,
  new Color(255, 255, 255)
);
const border = new Square(
  new Vector(canvas.width / 2, canvas.height / 2),
  width + 2 * canvas.ratio,
  height + 2 * canvas.ratio,
  new Color(0, 0, 0)
);
canvas.add(border);
canvas.add(box);

const oneText = new Text(
  new Vector(
    canvas.width / 2 - width / 2 - 15 * canvas.ratio,
    canvas.height / 2 - height / 2 + 10 * canvas.ratio
  ),
  '1',
  20,
  canvas.ratio
);
canvas.add(oneText);

const zeroText = new Text(
  new Vector(
    canvas.width / 2 - width / 2 - 15 * canvas.ratio,
    canvas.height / 2 + height / 2 + 5 * canvas.ratio
  ),
  '0',
  20,
  canvas.ratio
);
canvas.add(zeroText);

const defaultProbabilities = [0.5, 0.5];
let probabilities: number[] = [];

let storedProbabilities = localStorage.getItem('probabilities');
if (!storedProbabilities) {
  localStorage.setItem('probabilities', '[]');
  probabilities = defaultProbabilities;
} else {
  probabilities = JSON.parse(storedProbabilities);
}

const saveProbabilities = () => {
  localStorage.setItem('probabilities', JSON.stringify(probabilities));
};

const debounceSaveProbabilities = debounce(saveProbabilities, 100);

window.addProbability = () => {
  probabilities.push(0);
  window.updateUiProbabilities();
};

window.toggleRemoveProbability = () => {
  removingProbability = !removingProbability;
  setRemoveBtnText();
};

window.updateUiProbabilities = () => {
  const el = document.getElementById('probabilities');
  if (!el) return;
  el.innerHTML = '';
  probabilities.forEach((prob) => {
    const probEl = document.createElement('button');
    probEl.innerHTML = prob.toFixed(3);
    probEl.addEventListener('click', () => {
      window.navigator.clipboard.writeText(prob.toFixed(3));
    });
    el.appendChild(probEl);
  });
};

window.toggleImportInput = () => {
  const el = document.getElementById('input');
  if (!el) return;
  el.classList.toggle('toggled');
};

window.handleImportValues = () => {
  const el = document.getElementById('import-input') as HTMLTextAreaElement | null;
  if (!el) return;
  const val = el.value;
  probabilities = val
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length !== 0)
    .map(Number)
    .map((item) => Math.max(Math.min(item, 1), 0));
  probabilities = levelProbabilities(probabilities, probabilities.length - 1);
  debounceSaveProbabilities();
  window.updateUiProbabilities();
  window.toggleImportInput();
};

window.toggleExportValues = () => {
  const text = probabilities.join(',');
  const overlay = document.getElementById('export');
  if (!overlay) return;
  overlay.classList.toggle('toggled');
  const el = document.getElementById('export-val');
  if (!el) return;
  el.innerHTML = text;
};

window.updateUiProbabilities();

function setRemoveBtnText() {
  const btn = document.getElementById('toggle-remove');
  if (!btn) return;
  if (removingProbability) {
    btn.innerHTML = 'Cancel remove probability';
  } else {
    btn.innerHTML = 'Remove probability';
  }
}

window.addEventListener('resize', () => {
  box.moveTo(new Vector(canvas.width / 2, canvas.height / 2));
  border.moveTo(new Vector(canvas.width / 2, canvas.height / 2));
});

let dragging = false;
let draggingIndex = 0;
let prev = new Vector(0, 0);
let removingProbability = false;

canvas.on('mousedown', (e: MouseEvent) => {
  const p = new Vector(e.offsetX * canvas.ratio, e.offsetY * canvas.ratio);
  const index = getClosestProbabilityIndex(probabilities, p);
  if (removingProbability) {
    if (probabilities.length > 1) {
      probabilities.splice(index, 1);
      probabilities = levelProbabilities(probabilities, -1);
      window.updateUiProbabilities();
    }
    debounceSaveProbabilities();
    return;
  }
  dragging = true;
  draggingIndex = index;
});

canvas.on('mouseup', () => {
  dragging = false;
});

canvas.on('mousemove', (e: MouseEvent) => {
  const p = new Vector(e.offsetX, e.offsetY);
  if (dragging) {
    const diffY = -(p.y - prev.y) / (height / canvas.ratio);
    probabilities[draggingIndex] += diffY;
    probabilities[draggingIndex] = clamp(probabilities[draggingIndex], 0, 1);
    probabilities = levelProbabilities(probabilities, draggingIndex);
    debounceSaveProbabilities();
    window.updateUiProbabilities();
  }
  prev = p;
});

function levelProbabilities(probabilities: number[], currentIndex: number) {
  const excludeIndexes: number[] = [];
  let correctingAmount = 0;

  let diff = 1 - probabilities.reduce((prev, acc) => acc + prev, 0);

  function iteration(probabilities: number[], exclude: number[], diff: number) {
    return probabilities.map((prob, index) => {
      if (exclude.includes(index)) return prob;
      const newProb = prob + diff / (probabilities.length - 1);
      const clampedProb = clamp(newProb, 0, 1);
      const probDiff = clampedProb - newProb;
      correctingAmount += probDiff;
      excludeIndexes.push(index);
      return clampedProb;
    });
  }

  probabilities = iteration(probabilities, [currentIndex], diff);

  while (correctingAmount !== 0) {
    correctingAmount = 0;
    probabilities = iteration(probabilities, excludeIndexes, correctingAmount);
  }

  return probabilities;
}

function getClosestProbabilityIndex(probabilities: number[], p: Vector) {
  let dist = 0;
  let index = 0;
  for (let i = 0; i < probabilities.length; i++) {
    if (i === 0) {
      dist = distance(p, getProbabilityPoint(probabilities.length, i, probabilities[i]));
    } else {
      const temp = distance(p, getProbabilityPoint(probabilities.length, i, probabilities[i]));
      if (temp < dist) {
        dist = temp;
        index = i;
      }
    }
  }
  return index;
}

frameLoop(() => {
  drawLines(probabilities, removingProbability);
})();

function getProbabilityPoint(total: number, num: number, probability: number) {
  const inc = width / (total + 1);
  return new Vector(
    inc * (num + 1) + (canvas.width / 2 - width / 2),
    (1 - probability) * height + canvas.height / 2 - height / 2
  );
}

function drawLines(probabilities: number[], removingProbability: boolean) {
  if (probabilities.length === 0 || !canvas.ctx) return;

  const circleColor = removingProbability ? new Color(255, 0, 0) : new Color(0, 0, 0);

  const firstPos = getProbabilityPoint(probabilities.length, 0, probabilities[0]);
  new Line(
    new Vector(canvas.width / 2 - width / 2, canvas.height / 2 + height / 2),
    firstPos,
    new Color(0, 0, 0),
    canvas.ratio
  ).draw(canvas.ctx);

  for (let i = 0; i < probabilities.length - 1; i++) {
    const p1 = getProbabilityPoint(probabilities.length, i, probabilities[i]);
    const p2 = getProbabilityPoint(probabilities.length, i + 1, probabilities[i + 1]);
    new Line(p1, p2, new Color(0, 0, 0), canvas.ratio).draw(canvas.ctx);
    new Circle(p1, (removingProbability ? 4 : 2) * canvas.ratio, circleColor).draw(canvas.ctx);
  }

  const lastPos = getProbabilityPoint(
    probabilities.length,
    probabilities.length - 1,
    probabilities[probabilities.length - 1]
  );
  new Line(
    lastPos,
    new Vector(canvas.width / 2 + width / 2, canvas.height / 2 + height / 2),
    new Color(0, 0, 0),
    canvas.ratio
  ).draw(canvas.ctx);
  new Circle(lastPos, (removingProbability ? 4 : 2) * canvas.ratio, circleColor).draw(canvas.ctx);
}
