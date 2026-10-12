from vehicle_metadata_identification_using_machine_learning.service import tidy_label, tidy_team_output


def test_repeated_make_is_removed_from_the_model():
    raw = {"vehicles": [{"make": "Toyota", "model": "Toyota Hilux"}, {"make": "Lexus", "model": "Lexus ES"}]}
    out = tidy_team_output(raw)
    assert [v["model"] for v in out["vehicles"]] == ["Hilux", "ES"]


def test_model_without_the_make_is_left_alone():
    raw = {"vehicles": [{"make": "Ford", "model": "Fiesta hatchback"}]}
    assert tidy_team_output(raw)["vehicles"][0]["model"] == "Fiesta hatchback"


def test_lower_case_labels_are_capitalised_and_acronyms_kept():
    assert tidy_label("white") == "White"
    assert tidy_label("sports car") == "Sports Car"
    assert tidy_label("MPV") == "MPV"


def test_missing_attributes_are_left_as_none():
    raw = {"vehicles": [{"make": None, "model": None, "body_type": None, "colour": None}]}
    v = tidy_team_output(raw)["vehicles"][0]
    assert v["make"] is None and v["body_type"] is None and v["colour"] is None