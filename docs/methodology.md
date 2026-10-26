# Evaluation method and versioning

Evaluate the job's demands, not the person, their current salary or their performance. Record interviews, role documents and the evidence for each factor. Assessors must actively look for demands that are routinely overlooked, including interpersonal skill, emotional effort, responsibility for others and difficult working conditions.

OPEN-1 is a demonstration, with four equally weighted factors and five levels per factor. The exact level descriptions live in examples/framework.json. Total score is the sum of level multiplied by factor weight. E1 is 4 to 7, E2 is 8 to 11, E3 is 12 to 15 and E4 is 16 to 20, inclusive. These grade labels and thresholds are illustrative house choices. They are neither gradar's formula nor a validated gender-inclusive scheme.

Before business use, commission a competent evaluation of the method, descriptors, weights, comparator jobs and its application. Imported gradar grades remain separate. Never convert them to OPEN-1 grades by numeric range or assume that equal labels imply equivalent work.

A new framework is supplied as a JSON file to add-framework. It must contain a nonempty version, the four factor codes skills, effort, responsibility and conditions, five nonempty level descriptions per factor, integer weights from 1 to 100, and uniquely named, ordered, contiguous grade ranges covering every possible score. A changed method is a new code and version; existing decisions retain their full snapshot.

Each job revision is captured when an evaluation starts. Factor rationale and evidence are mandatory. Approval requires an independent reviewer, a decision note and explicit evidence of the bias review. These labels and notes are recorded evidence, not an authenticated identity or an automated finding that a method is unbiased. Frameworks, decisions and events are immutable through the application. Trusted database owners still have administrative power.

Review-date intervals are chosen by the organisation. They are not statutory periods. Any changed profile invalidates the prior current grade conservatively, including a change to owner or review date. A new evaluation may retain factor levels only after the evaluator checks the new basis and records the evidence again.
