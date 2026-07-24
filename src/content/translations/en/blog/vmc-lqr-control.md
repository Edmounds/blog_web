---
title: Hello
description: My first blog post.
createdAt: 2026-01-28T00:00:00.000Z
published: true
order: 1
tags:
  - Essay
---

# Control Strategy and Simulation Verification

In this project, the simulation component mainly serves two purposes: first, to place the wheeled-legged robot’s mechanical structure into a computable dynamics environment; second, to validate the balance, walking, and jumping control ideas before physical debugging. The simulation platform is MuJoCo. The modeling workflow follows the order from mechanical design to simulation: first obtain a URDF by organizing the STEP mechanical model, then convert it to MJCF via MuJoCo, and finally supplement the MJCF with four-bar closed-chain constraints, actuators, collisions, and test terrain.

The control algorithm does not stop at simple PID tuning; instead, it uses a combined LQR + VMC approach. LQR is responsible for body balance, velocity, and heading, while VMC handles leg height, four-bar linkage motion, and the jumping process. This division of labor is better suited to wheeled-legged robots, because wheels and legs take on different tasks at different stages, and not all actions can be handled by a single control loop.

![MuJoCo simulation model generation workflow](https://img.muelsyse.us/blog/aef376fcd64e4d81a4330335441b6dcd1730c9d4336a59fb861ea8e9a083ffef.svg)

## MuJoCo Simulation Model Generation Workflow

The mechanical model originally comes from a STEP file. To enter MuJoCo, the structure must first be organized into a URDF. The URDF retains the chassis, left and right wheels, active leg joints, passive linkages, and mesh models, and is the source of the simulation model.

At simulation startup, MuJoCo converts the URDF to MJCF. The converted model still needs additional simulation information, including the free joint of the body, wheel-leg actuators, collision proxies, terrain, and the initial standing pose. The purpose of this step is not to redesign the model, but to turn the mechanical structure into a controllable, contactable, and verifiable dynamics model.

The four-bar linkage is a key focus of this part. URDF itself is better suited to expressing tree structures, whereas my leg mechanism is a closed-chain four-bar linkage. To address this, connection constraints are used in the MJCF to close the passive linkages with the active linkages, allowing MuJoCo to solve the closed-chain constraint forces during simulation. This preserves the STEP-to-URDF modeling workflow while obtaining leg motion close to that of the real mechanism.

The simulation environment includes flat ground, a single-wheel slope, and wavy terrain. Flat ground is used for basic standing and walking tests; the single-wheel slope is used to observe roll compensation when left and right wheel heights differ; wavy terrain is used to check stability under continuous contact disturbances. Complex meshes are mainly for display; actual contact uses simplified collision bodies for more stable simulation.

## Overall Algorithm Architecture

The control system runs in the order of “state extraction, balance control, leg control, and control allocation.” At each simulation step, body attitude, body velocity, left and right wheel speeds, leg state, and contact conditions are read first. Then LQR computes the virtual control quantities needed for balance from attitude and wheel speeds, and VMC computes leg motor torques from the target leg height and four-bar geometry. Finally, according to the current motion phase, the control quantities are allocated to the wheel motors and leg motors.

Balance control focuses on five state categories: pitch angle, pitch angular velocity, roll angle, roll angular velocity, and average wheel speed. Wheel position is not placed directly in the LQR inner loop, because wheel position undergoes large transient changes during jumping and landing. Position drift is handled by a slower outer loop; the inner loop only manages attitude and wheel speed, so the control response is cleaner.

The LQR output can be understood as two types of actions: one is fore-aft wheel torque, used to maintain pitch balance and velocity; the other is left-right differential control, used to handle roll attitude. Steering control is achieved through the left-right wheel torque difference, and heading hold locks the current direction when there is no active steering command.

VMC is responsible for the legs. Leg control does not apply a spring directly to leg height; instead, it first converts the target leg height into active motor angles according to the four-bar geometry, then performs joint-space tracking. This avoids amplification near singular configurations of the four-bar linkage and is closer to the control quantities that the actual motors can execute.

![LQR + VMC control architecture](https://img.muelsyse.us/blog/36357886a211c5a9e1f9664b9ecb190aa034a1fe9054c8cab2415e58a6783ab5.svg)

## Four-Bar VMC Design

The difficulty of the four-bar leg is that the relationship between active motor angle and wheel-center height is not linear. At different leg heights, the same motor angle change produces different wheel-center height changes. Therefore, the simulation first establishes the correspondence between leg height and active motor angle, then uses the current mechanism geometry to compute the sensitivity of height change to motor angle.

In the standing phase, VMC mainly accomplishes three things: maintain the target leg height, compensate gravity, and suppress leg velocity error. In this way the robot can maintain a stable height on flat ground and return to the target pose after mild disturbances.

On slope scenarios, left and right wheel heights differ. If both legs are kept at the same height, the body will roll. To address this, the controller adds opposite height offsets to the two legs according to the left-right wheel height difference, so the body stays as level as possible. When the slope is steeper, the controller also appropriately lowers the overall standing height to avoid extending one side of the leg to the mechanism limit.

The jumping phase places higher demands on leg control. The crouch phase needs smooth leg retraction, the extension phase needs rapid thrust output, and the landing phase must absorb impact. In this project, standing gains and landing gains are set separately, avoiding making landing too stiff for the sake of standing stability, and avoiding sacrificing standing stiffness for soft landing.

## Jump Phase Machine Design

The jump process is split into five phases: standing, crouch, extension, flight, and landing. When the state exceeds the safe range, the system enters fall protection. With this treatment, each phase is responsible only for its own control objectives, and it is easier during debugging to tell which segment a problem comes from.

Crouch and landing use smooth trajectories to ensure continuous changes in height, velocity, and acceleration. The extension phase adopts a constant-acceleration approach: the liftoff velocity and extension time are back-calculated from the target jump height, so thrust participates from the start of extension rather than being concentrated in a short final interval.

The jump trajectory does not use a fixed extension endpoint, but a fixed extension stroke. This is so that takeoff motions are more consistent across different standing heights. When taking off from a low standing height, if a fixed endpoint is still tracked, the leg stroke becomes longer, the body more easily acquires excess pitch angular momentum, and forward pitch and drift both increase on landing.

When phases switch, the control authority of the wheels and legs also changes. In the standing phase, LQR and VMC work together; in the crouch, extension, and landing phases, the leg motors are mainly under VMC trajectory control, while LQR only maintains body attitude through the wheels; in the flight phase, wheel torque is zeroed and only damping on pitch angular velocity is retained. This reduces airborne wheel spin and landing recoil.

![Jump phase machine](https://img.muelsyse.us/blog/bd64bc8d70d86e5486ed4b4b895c2cb7ce2e9b72396fdd17d878dea078a9958a.svg)

## Engineering Implementation Features

Model generation and control verification are handled separately. The URDF retains the mechanical structure; the MJCF is responsible for the constraints, actuators, terrain, and contact needed for simulation. In this way, modifying the simulation environment does not break the original mechanical model.

Control input uses a unified command interface, including forward velocity, steering velocity, target height, and jump trigger. Both gamepad control and automated tests go through the same entry point, so interactive simulation and headless tests can reuse the same control logic.

LQR gains are cached by leg height and roll state. When leg height changes, control gains do not need to be re-solved at every step, so simulation runs more stably and batch testing is easier later.

Actuator limits are handled by motion phase. Standing, crouch, and landing phases use more conservative leg motor torques; the extension phase allows greater thrust; the flight phase disables wheel torque. This rule directly serves jump stability.

## Simulation Verification Results

At present, the simulation already covers standing, walking, jumping, single-wheel obstacle crossing, and fall protection. Standing tests mainly check whether LQR and VMC can maintain attitude and height; walking tests mainly check target velocity, heading hold, and the position outer loop; jump tests mainly check phase switching, extension thrust, and landing cushioning; single-wheel slope tests mainly check whether roll compensation is effective.

From the simulation results, this work has progressed from “tuning a set of parameters that can stand” to “validating a wheeled-leg control architecture.” In subsequent physical debugging, motor torque, wheel-ground friction, sensor delay, and four-bar zero positions need to be further calibrated so that the LQR + VMC control approach from simulation can transfer more stably to the physical robot.


==CODE TEST==
```python
import numpy
```
- test1
- test2
  - test3
  - test4
    - test5

1. numtest1