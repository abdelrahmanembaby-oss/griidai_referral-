from typing import Optional

TEMP_DOMAINS = [
    "mailinator.com",
    "tempmail.com",
    "10minutemail.com",
    # add more as needed
]


def is_suspicious(referrer, new_user_email: str, ip_address: Optional[str], device_fp: Optional[str]) -> bool:
    # same IP
    if ip_address and referrer.ip_address and ip_address == referrer.ip_address:
        return True

    # same device
    if device_fp and referrer.device_fingerprint and device_fp == referrer.device_fingerprint:
        return True

    # same email domain
    ref_dom = referrer.email.split("@")[1]
    new_dom = new_user_email.split("@")[1]
    if ref_dom == new_dom:
        return True

    # temporary domains
    if new_dom in TEMP_DOMAINS:
        return True

    return False
