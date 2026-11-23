from typing import TypedDict


class SalesState(TypedDict, total=False):
    product_id: int
    prospect_id: int
    product: dict
    prospect: dict
    business_profile: dict
    icp: dict
    buying_signals: dict
    problem: dict
    score: dict
    email: dict
    reply: dict
