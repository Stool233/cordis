# Cordis implementation guide

English | [中文](formal-study.zh-CN.md)

Use this page to locate the Cordis source selected by the [current study](https://github.com/Stool233/cordis-formal-study). The portal owns the paper reading, shared checks, and result report.

## Read the selected source

The study uses [Cordis core at 18c327f](https://github.com/Stool233/cordis/tree/18c327f4566e8f640737c43a480e6d74a0673579/packages/core/src), based on official [f8ea3cd](https://github.com/cordiverse/cordis/tree/f8ea3cd50f1a5724e8e715995bcde131c9c12b2c). The fork commit includes lifecycle fixes and ordinary regressions. Its branch is `codex/upstream-alignment-2026-09-09`; the full commit in the portal lock identifies the evidence.

Fiber manages plugin activation and cleanup. Its disposal path retains the consumer's registry entry until cleanup finishes and waits for dependent cleanup before provider recovery. Service resolution carries provider identity. The [paper guide](https://github.com/Stool233/cordis-formal-study/blob/main/docs/paper.md) explains the corresponding requirements.

## Check the behavior

The portal runs three shared behavior checks on this source and on the Harness fork: dependency cleanup order, retirement discoverability, and replacement-provider identity. It exports committed source and executes real Context operations without trace instrumentation.

Follow [Reproduction](https://github.com/Stool233/cordis-formal-study/blob/main/docs/reproduce.md) to run the checks. [Verification](https://github.com/Stool233/cordis-formal-study/blob/main/docs/verification.md) defines the inputs and the scope of a pass.

## Further reading

The [implementation reference](https://github.com/Stool233/cordis-formal-study/blob/main/docs/implementation.md) owns version selection and dependency details. The [archive](https://github.com/Stool233/cordis-formal-study/blob/main/archive/README.md) preserves earlier branches and model evidence.
