---
title: VMC LQR Wheel-Legged Robot Control
description: Test test
createdAt: 2026-07-25T00:00:00.000Z
published: true
order: 1
tags:
  - Control Algorithms
---

# Control Strategy and Simulation Validation

In this project, the simulation serves two main purposes: first, to place the mechanical structure of the wheel-legged robot into a computable dynamics environment; and second, to validate the balance, locomotion, and jumping control concepts before physical debugging. MuJoCo is used as the simulation platform. The model workflow follows the sequence from mechanical design to simulation: the STEP mechanical model is first organized into a URDF, then converted by MuJoCo into MJCF, and finally supplemented in MJCF with closed-chain constraints for the four-bar linkage, actuators, collision geometry, and test terrains.

The control algorithm does not stop at simple PID tuning, but instead adopts a combination of LQR + VMC. LQR is responsible for body balance, velocity, and heading, while VMC handles leg height, four-bar linkage motion, and the jumping process. This division of responsibilities is better suited to a wheel-legged robot because the wheels and legs perform different tasks at different stages, so all actions cannot be assigned to the same control loop.

![MuJoCo simulation model generation workflow](https://img.muelsyse.us/blog/aef376fcd64e4d81a4330335441b6dcd1730c9d4336a59fb861ea8e9a083ffef.svg)

## MuJoCo Simulation Model Generation Workflow

The mechanical model initially comes from a STEP file. To bring it into MuJoCo, the structure must first be organized into a URDF. The URDF retains the body, left and right wheels, active leg joints, passive links, and mesh models, and serves as the source model for the simulation.

When the simulation starts, MuJoCo converts the URDF into MJCF. The converted model still needs additional simulation information, including body free joints, wheel and leg actuators, collision proxies, terrain, and the initial standing posture. The purpose of this step is not to redesign the model, but to turn the mechanical structure into a dynamics model that can be controlled, make contact, and be validated.

The four-bar linkage is the key focus of this part. URDF is better suited to expressing tree structures, whereas the leg mechanism here is a closed-chain four-bar linkage. To address this, MJCF uses equality constraints to close the passive and active links, allowing MuJoCo to solve the closed-chain constraint forces during simulation. This preserves the modeling workflow from STEP to URDF while producing leg motion that is close to that of the real mechanism.

The simulation environment includes flat ground, a single-wheel slope, and wavy terrain. Flat ground is used for basic standing and locomotion tests; the single-wheel slope is used to observe roll compensation when the heights of the left and right wheels differ; and the wavy terrain is used to check stability under continuous contact disturbances. Complex meshes are mainly used for visualization, while actual contact uses simplified collision bodies to make the simulation more stable.

## Overall Algorithm Architecture

The control system runs in the sequence of “state extraction, balance control, leg control, and control allocation.” At each simulation step, it first reads the body attitude, body velocity, left and right wheel speeds, leg states, and contact conditions. LQR then calculates the virtual control quantities required for balance based on the attitude and wheel speeds, while VMC calculates the leg motor torques based on the target leg height and four-bar linkage geometry. Finally, the control quantities are allocated to the wheel and leg motors according to the current motion phase.

Balance control focuses on five types of state: pitch angle, pitch angular velocity, roll angle, roll angular velocity, and average wheel speed. Wheel position is not directly included in the LQR inner loop because the wheel position undergoes relatively large transient changes during jumping and landing. Position drift is handled by a slower outer loop, while the inner loop focuses only on attitude and wheel speed, resulting in a cleaner control response.

The LQR output can be understood as two types of action: one is the wheel torque in the forward and backward directions, used to maintain pitch balance and velocity; the other is differential left-right control, used to handle the roll attitude. Steering control is implemented through the difference between the left and right wheel torques, while heading maintenance locks the current direction when there is no active steering command.

VMC is responsible for the legs. Leg control does not apply a spring directly to the leg height. Instead, it first converts the target leg height into the active motor angle according to the four-bar linkage geometry, and then performs joint-space tracking. This avoids amplification near singular configurations of the four-bar linkage and is also closer to the control quantities that the actual motors can execute.

![LQR + VMC control architecture](https://img.muelsyse.us/blog/36357886a211c5a9e1f9664b9ecb190aa034a1fe9054c8cab2415e58a6783ab5.svg)

## Four-Bar Linkage VMC Design

The difficulty of the four-bar linkage leg lies in the fact that the relationship between the active motor angle and the wheel-center height is nonlinear. At different leg heights, the same change in motor angle produces different changes in wheel-center height. Therefore, the simulation first establishes the correspondence between leg height and active motor angle, and then uses the current mechanism geometry to calculate the sensitivity of height changes to the motor angle.

During the standing phase, VMC mainly performs three tasks: maintaining the target leg height, compensating for gravity, and suppressing leg velocity error. This allows the robot to maintain a stable height on flat ground and return to the target posture after minor disturbances.

On a slope, the heights of the left and right wheels differ. If both legs only maintain the same height, the body will roll. To solve this problem, the controller adds opposite height offsets to the two legs according to the height difference between the left and right wheels, keeping the body as level as possible. When the slope is steep, the controller also appropriately lowers the overall standing height to prevent either leg from reaching its mechanical limit.

The leg control requirements are higher during jumping. The crouching phase requires smooth leg retraction, the extension phase requires rapid thrust output, and the landing phase must absorb impact. In the project, the standing gains and landing gains are configured separately. This avoids making landing too stiff in pursuit of stable standing, and also avoids sacrificing standing stiffness in pursuit of softer landings.

## Jumping State Machine Design

The jumping process is divided into five phases: standing, crouching, extension, airborne, and landing. When the state exceeds the safety range, the system enters fall protection. With this approach, each phase is responsible only for its own control objectives, making it easier during debugging to determine which phase is causing a problem.

Smooth trajectories are used for crouching and landing to ensure continuous changes in height, velocity, and acceleration. The extension phase adopts a constant-acceleration approach, deriving the takeoff velocity and extension time from the target jump height, allowing thrust to contribute from the beginning of extension rather than being concentrated in the final short interval.

The jumping trajectory does not use a fixed extension endpoint, but instead uses a fixed extension travel. This is intended to make takeoff actions more consistent at different standing heights. During takeoff from a low standing height, if the controller still tracks a fixed endpoint, the leg travel becomes longer, making it easier for the body to acquire excess pitch angular momentum and increasing forward tilt and drift during landing.

The control authority of the wheels and legs also changes during phase transitions. During the standing phase, LQR and VMC work simultaneously. During crouching, extension, and landing, the leg motors are primarily controlled by the VMC trajectory, while LQR maintains the body attitude through the wheels. During the airborne phase, wheel torque is set to zero, leaving only damping for pitch angular velocity. This reduces wheel spinning in the air and rebound during landing.

![Jumping state machine](https://img.muelsyse.us/blog/bd64bc8d70d86e5486ed4b4b895c2cb7ce2e9b72396fdd17d878dea078a9958a.svg)

## Engineering Implementation Features

Model generation and control validation are handled separately. The URDF preserves the mechanical structure, while the MJCF is responsible for the constraints, actuators, terrain, and contact required by the simulation. This ensures that modifying the simulation environment does not damage the original mechanical model.

The control input uses a unified command interface, including forward velocity, steering velocity, target height, and jump trigger. Both gamepad control and automated tests use the same entry point, allowing interactive simulation and headless testing to reuse the same control logic.

LQR gains are cached according to leg height and roll state. When the leg height changes, the control gains do not need to be recalculated at every step, making the simulation more stable and facilitating subsequent batch testing.

Actuator limits are handled according to the motion phase. More conservative leg motor torques are used during standing, crouching, and landing; greater thrust is allowed during extension; and wheel torque is disabled during the airborne phase. This rule directly serves jumping stability.

## Simulation Validation Results

The current simulation covers standing, locomotion, jumping, single-wheel obstacle traversal, and fall protection. Standing tests mainly examine whether LQR and VMC can maintain attitude and height; locomotion tests mainly examine target velocity, heading maintenance, and the position outer loop; jumping tests mainly examine phase transitions, extension thrust, and landing buffering; and single-wheel slope tests mainly examine whether roll compensation is effective.

According to the simulation results, this work has progressed from “tuning a set of parameters that can keep the robot standing” to “validating a wheel-legged control architecture.” During subsequent physical debugging, motor torque, wheel-ground friction, sensor latency, and the zero position of the four-bar linkage will need to be calibrated further so that the LQR + VMC control approach in simulation can be transferred more reliably to the physical robot.


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