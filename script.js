const SEGMENTS = 18;
const worm = [];
let step = 0;

// Autonomous movement variables
let target = {
  x: Math.random() * innerWidth,
  y: Math.random() * innerHeight,
};
let velocity = { x: 0, y: 0 };
const MAX_SPEED = 2;
const TURN_RATE = 0.05;

// CREATE HEAD
const head = document.createElement("div");
head.className = "head";
head.innerHTML = `
  <div class="eye left"></div>
  <div class="eye right"></div>
  <div class="fang left"></div>
  <div class="fang right"></div>
`;
document.body.appendChild(head);

const headPos = { x: target.x, y: target.y };

// CREATE BODY SEGMENTS
for (let i = 0; i < SEGMENTS; i++) {
  const seg = document.createElement("div");
  seg.className = "segment";

  const leftLeg = document.createElement("div");
  leftLeg.className = "leg left";
  const leftLower = document.createElement("div");
  leftLower.className = "lower";
  leftLeg.appendChild(leftLower);

  const rightLeg = document.createElement("div");
  rightLeg.className = "leg right";
  const rightLower = document.createElement("div");
  rightLower.className = "lower";
  rightLeg.appendChild(rightLower);

  seg.appendChild(leftLeg);
  seg.appendChild(rightLeg);
  document.body.appendChild(seg);

  worm.push({
    el: seg,
    x: headPos.x,
    y: headPos.y,
    leftLeg,
    leftLower,
    rightLeg,
    rightLower,
    offset: i * 0.5,
  });
}

// ANIMATE FUNCTION
function animate() {
  step += 0.25;

  // Random target movement
  if (
    Math.hypot(target.x - headPos.x, target.y - headPos.y) < 50 ||
    Math.random() < 0.005
  ) {
    target.x = Math.random() * innerWidth;
    target.y = Math.random() * innerHeight;
  }

  // Steering behavior
  const dx = target.x - headPos.x;
  const dy = target.y - headPos.y;
  const angle = Math.atan2(dy, dx);

  velocity.x += Math.cos(angle) * TURN_RATE;
  velocity.y += Math.sin(angle) * TURN_RATE;

  // Limit speed
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed > MAX_SPEED) {
    velocity.x = (velocity.x / speed) * MAX_SPEED;
    velocity.y = (velocity.y / speed) * MAX_SPEED;
  }

  // Move head
  headPos.x += velocity.x;
  headPos.y += velocity.y;

  // Screen bounce
  if (headPos.x < 0 || headPos.x > innerWidth) velocity.x *= -1;
  if (headPos.y < 0 || headPos.y > innerHeight) velocity.y *= -1;

  head.style.left = headPos.x + "px";
  head.style.top = headPos.y + "px";

  // Eye tracking towards target
  const eyes = head.querySelectorAll(".eye");
  eyes.forEach((eye) => {
    const ex = target.x - headPos.x;
    const ey = target.y - headPos.y;
    const eAngle = Math.atan2(ey, ex);
    eye.style.transform = `translate(${Math.cos(eAngle) * 1.5}px, ${
      Math.sin(eAngle) * 1.5
    }px)`;
  });

  // BODY FOLLOW
  worm[0].x += (headPos.x - worm[0].x) * 0.3;
  worm[0].y += (headPos.y - worm[0].y) * 0.3;

  for (let i = 1; i < SEGMENTS; i++) {
    worm[i].x += (worm[i - 1].x - worm[i].x) * 0.25;
    worm[i].y += (worm[i - 1].y - worm[i].y) * 0.25;
  }

  // LEGS WALKING
  worm.forEach((seg, i) => {
    seg.el.style.left = seg.x + "px";
    seg.el.style.top = seg.y + "px";

    const phase = step + seg.offset;
    const upperSwing = Math.sin(phase) * 35;
    const lowerSwing = Math.cos(phase) * 25;

    seg.leftLeg.style.transform = `rotate(${-60 + upperSwing}deg)`;
    seg.leftLower.style.transform = `rotate(${30 + lowerSwing}deg)`;

    seg.rightLeg.style.transform = `rotate(${60 - upperSwing}deg)`;
    seg.rightLower.style.transform = `rotate(${-30 - lowerSwing}deg)`;
  });

  requestAnimationFrame(animate);
}

animate();
