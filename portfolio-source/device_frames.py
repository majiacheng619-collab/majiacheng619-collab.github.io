"""Decorative device surrounds for real screen captures."""


def device_frame(content, kind='ipad'):
    if kind not in ('ipad', 'tablet'):
        raise ValueError('Unknown device surround')
    if kind == 'ipad':
        return (
            '<span class="device-frame device-frame--ipad" data-device-frame="ipad">'
            '<img class="ipad-hardware" src="assets/ipad-pro-m5.d67558d91a2d.jpg" alt="" aria-hidden="true" width="3504" height="2784" loading="lazy" decoding="async">'
            '<span class="device-frame__screen">' + content + '</span></span>'
        )
    return (
        f'<span class="device-frame device-frame--{kind}" data-device-frame="{kind}">'
        '<span class="device-frame__body">'
        '<span class="device-frame__camera" aria-hidden="true"></span>'
        '<span class="device-frame__screen">' + content + '</span></span>'
        + '</span>'
    )
