"""A lightweight unbranded surround for actual game captures."""


def device_frame(content):
    return ('<span class="device-frame" data-device-frame="capture">'
            '<span class="device-frame__screen">' + content + '</span></span>')
