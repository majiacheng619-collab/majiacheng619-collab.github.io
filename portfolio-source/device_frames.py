"""Decorative device surrounds for real screen captures."""


def device_frame(content, kind='mac'):
    if kind not in ('mac', 'tablet'):
        raise ValueError('Unknown device surround')
    return (
        f'<span class="device-frame device-frame--{kind}" data-device-frame="{kind}">'
        '<span class="device-frame__body">'
        '<span class="device-frame__camera" aria-hidden="true"></span>'
        '<span class="device-frame__screen">' + content + '</span></span>'
        + ('<span class="device-frame__base" aria-hidden="true"></span>' if kind == 'mac' else '')
        + '</span>'
    )
