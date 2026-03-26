# Research Dashboard Codebook

This dashboard now exposes three research-ready datasets for SSCI-style analysis.

## 1. Student-Chapter Dataset

Unit of analysis: one student in one chapter submission.

Core variables:

- `student_id`
- `student_name`
- `chapter_id`
- `session_id`
- `submitted_at`
- `score`
- `correct_count`
- `total_count`
- `turn_count`
- `hint_count`
- `avg_user_len`
- `blocked_question_count`
- `partial_rate`
- `productive_struggle_index`
- `hint_dependency_index`
- `self_explanation_index`
- `misconception_repair_rate`
- `reflection_submitted`
- `reflection_quality_index`
- `persistence_index`
- `weak_concepts_count`
- `weak_concepts`

Operational definitions:

- `productive_struggle_index`: higher when students sustain interaction, reach partial/correct judgments, and are not repeatedly blocked.
- `hint_dependency_index`: higher when hint use and incorrect judgments remain high.
- `self_explanation_index`: higher when user messages are longer and contain explanatory markers.
- `misconception_repair_rate`: percent of judged items that reached partial or correct status.
- `reflection_quality_index`: derived from goal-setting, strategy, error-awareness, action-plan, and transfer-plan signals in reflection entries.
- `persistence_index`: higher when students sustain interaction, complete more judged items, and submit reflection.

## 2. Attempt-Level Dataset

Unit of analysis: one assessed item attempt trace.

Core variables:

- `student_id`
- `student_name`
- `chapter_id`
- `session_id`
- `question_order`
- `question_id`
- `concept`
- `question_text`
- `judgment`
- `advance`
- `next_action`
- `hint_count`
- `attempt_count`
- `answer_length`
- `timestamp`

Recommended analyses:

- sequential pattern analysis
- lag sequential analysis
- mixed models with attempts nested in students
- transition probability tables

## 3. Reflection-Coded Dataset

Unit of analysis: one reflection record.

Core variables:

- `student_id`
- `student_name`
- `chapter_id`
- `saved_at`
- `is_deleted`
- `q1_goal_setting`
- `q1_strategy_use`
- `q2_error_awareness`
- `q2_concept_reference_count`
- `q3_action_plan`
- `q3_transfer_plan`
- `reflection_quality_index`
- `linked_score`
- `linked_weak_concepts`
- `q1_text`
- `q2_text`
- `q3_text`

Recommended validation:

- dual coding on a subsample
- Cohen's kappa for the binary coding fields
- chapter fixed effects in inferential models
- student random intercepts for repeated measures
