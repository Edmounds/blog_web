---
title: VMC LQR Wheeled-Legged Robot Control
description: Test test
createdAt: 2026-07-25T00:00:00.000Z
published: true
order: 1
tags:
  - Control Algorithms
---

In this project, the simulation serves two main purposes: first, to place the mechanical structure of the wheeled-legged robot into a computable dynamics environment; and second, to validate balance, locomotion, and jumping control concepts before testing on the physical robot. MuJoCo is used as the simulation platform. The model workflow follows the order from mechanical design to simulation: the STEP mechanical model is first organized into a URDF, then converted by MuJoCo into MJCF, and finally supplemented in MJCF with closed-chain constraints for the four-bar linkage, actuators, collision geometry, and test terrains.

The control algorithm does not stop at simple PID tuning, but instead uses a combination of LQR and VMC. LQR is responsible for body balance, velocity, and heading, while VMC handles leg height, four-bar linkage motion, and the jumping process. This division of responsibilities is better suited to a wheeled-legged robot because the wheels and legs serve different purposes at different stages, and all actions cannot be assigned to a single control loop.

![MuJoCo simulation model generation process](https://img.muelsyse.us/blog/aef376fcd64e4d81a4330335441b6dcd1730c9d4336a59fb861ea8e9a083ffef.svg)

## MuJoCo Simulation Model Generation Process

The mechanical model initially comes from a STEP file. To bring it into MuJoCo, the structure must first be organized into a URDF. The URDF retains the body, left and right wheels, active leg joints, passive links, and mesh models, and serves as the source of the simulation model.

When the simulation starts, MuJoCo converts the URDF into MJCF. The converted model still needs additional simulation information, including a free joint for the body, wheeled-legged actuators, collision proxies, terrain, and the initial standing posture. The purpose of this step is not to redesign the model, but to turn the mechanical structure into a dynamic model that can be controlled, subjected to contact, and validated.

The four-bar linkage is the key focus of this part. URDF is better suited to representing tree structures, whereas the leg mechanism here is a closed-chain four-bar linkage. To address this, connection constraints are used in MJCF to close the passive and active links, allowing MuJoCo to solve the closed-chain constraint forces during simulation. This preserves the modeling workflow from STEP to URDF while producing leg motion that more closely resembles the real mechanism.

The simulation environment includes flat ground, a single-wheel slope, and a wavy surface. Flat ground is used for basic standing and locomotion tests; the single-wheel slope is used to observe roll compensation when the left and right wheel heights differ; and the wavy surface is used to check stability under continuous contact disturbances. Complex meshes are mainly used for visualization, while simplified collision geometries are used for actual contact, making the simulation more stable.

## Overall Algorithm Architecture

The control system runs in the order of “state extraction, balance control, leg control, and control allocation.” At each simulation step, it first reads the body attitude, body velocity, left and right wheel speeds, leg states, and contact conditions. LQR then calculates the virtual control quantities required for balance based on the attitude and wheel speeds, while VMC calculates the leg motor torques based on the target leg height and four-bar linkage geometry. Finally, the control quantities are allocated to the wheel and leg motors according to the current motion phase.

Balance control focuses on five types of states: pitch angle, pitch angular velocity, roll angle, roll angular velocity, and average wheel speed. Wheel position is not directly included in the LQR inner loop because wheel position undergoes large transient changes during jumping and landing. Position drift is handled by a slower outer loop, while the inner loop only manages attitude and wheel speed, resulting in a cleaner control response.

The LQR output can be understood as two types of actions: one is the wheel torque in the fore-aft direction, used to maintain pitch balance and velocity; the other is differential left-right control, used to handle roll attitude. Steering control is achieved through the difference between the left and right wheel torques, while heading hold locks the current direction when there is no active steering command.

VMC is responsible for the legs. Leg control does not directly apply a spring to the leg height. Instead, it first converts the target leg height into active motor angles according to the four-bar linkage geometry, and then performs joint-space tracking. This avoids amplification near singular configurations of the four-bar linkage and is also closer to the control quantities that the actual motors can execute.

![LQR + VMC control architecture](https://img.muelsyse.us/blog/36357886a211c5a9e1f9664b9ecb190aa034a1fe9054c8cab2415e58a6783ab5.svg)

## Four-Bar Linkage VMC Design

The difficulty with a four-bar linkage leg is that the relationship between the active motor angle and the wheel-center height is nonlinear. At different leg heights, the same change in motor angle produces different changes in wheel-center height. Therefore, the simulation first establishes the correspondence between leg height and active motor angle, and then uses the current mechanism geometry to calculate the sensitivity of height changes to the motor angle.

During the standing phase, VMC mainly performs three tasks: maintaining the target leg height, compensating for gravity, and suppressing leg velocity errors. This allows the robot to maintain a stable height on flat ground and return to the target posture after minor disturbances.

On a slope, the left and right wheel heights differ. If both legs simply maintain the same height, the body will roll. To solve this problem, the controller adds opposite height offsets to the two legs according to the height difference between the left and right wheels, keeping the body as level as possible. When the slope is steep, the controller also appropriately lowers the overall standing height to prevent either leg from reaching its mechanical limit.

Leg control requirements are higher during jumping. The crouching phase requires smooth leg retraction, the extension phase requires rapid thrust output, and the landing phase must absorb impact. In the project, standing gains and landing gains are configured separately, avoiding overly stiff landings in pursuit of stable standing and avoiding insufficient standing stiffness in pursuit of softer landings.

## Jumping State Machine Design

The jumping process is divided into five phases: standing, crouching, extension, airborne, and landing. When the state exceeds the safety range, the system enters fall protection. With this approach, each phase is responsible only for its own control objectives, making it easier to determine during debugging which phase is causing a problem.

Smooth trajectories are used for crouching and landing to ensure continuous changes in height, velocity, and acceleration. The extension phase uses a constant-acceleration approach, deriving the takeoff velocity and extension time from the target jump height so that thrust begins contributing as soon as extension starts rather than being concentrated in the final short segment.

The jump trajectory does not use a fixed extension endpoint, but instead uses a fixed extension stroke. This is intended to make takeoff motions more consistent at different standing heights. During takeoff from a low standing height, continuing to track a fixed endpoint would lengthen the leg stroke, making it easier for the body to gain excess pitch angular momentum and increasing forward lean and drift during landing.

Control authority over the wheels and legs also changes during phase transitions. During the standing phase, LQR and VMC work simultaneously; during the crouching, extension, and landing phases, the leg motors are primarily controlled by the VMC trajectory, while LQR maintains body attitude through the wheels; during the airborne phase, wheel torque is set to zero, leaving only damping for pitch angular velocity. This reduces free spinning of the wheels in the air and rebound during landing.

![Jumping state machine](https://img.muelsyse.us/blog/bd64bc8d70d86e5486ed4b4b895c2cb7ce2e9b72396fdd17d878dea078a9958a.svg)

## Engineering Implementation Features

Model generation and control validation are handled separately. URDF preserves the mechanical structure, while MJCF handles the constraints, actuators, terrain, and contact required for simulation. This ensures that modifying the simulation environment does not damage the original mechanical model.

Control inputs use a unified command interface, including forward velocity, steering velocity, target height, and jump trigger. Both gamepad control and automated tests use the same entry point, allowing interactive simulation and headless testing to share the same control logic.

LQR gains are cached according to leg height and roll state. The control gains do not need to be recalculated at every step when the leg height changes, making the simulation more stable and facilitating subsequent batch testing.

Actuator limits are handled according to the motion phase. More conservative leg motor torques are used during standing, crouching, and landing; greater thrust is permitted during extension; and wheel torque is disabled during the airborne phase. This rule directly serves jumping stability.

## Simulation Validation Results

The current simulation covers standing, locomotion, jumping, single-wheel obstacle traversal, and fall protection. Standing tests mainly examine whether LQR and VMC can maintain attitude and height; locomotion tests mainly examine target velocity, heading hold, and the position outer loop; jumping tests mainly examine phase transitions, extension thrust, and landing cushioning; and single-wheel slope tests mainly examine the effectiveness of roll compensation.

Based on the simulation results, this work has progressed from “tuning a set of parameters that allows the robot to stand” to “validating a complete wheeled-legged robot control architecture.” During subsequent physical-robot debugging, motor torque, wheel-ground friction, sensor latency, and the zero position of the four-bar linkage will need to be calibrated further so that the LQR + VMC control concept from the simulation can be transferred more reliably to the physical robot.