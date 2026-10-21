"""Decorative device surrounds for real screen captures."""


def device_frame(content, kind='mac'):
    if kind not in ('mac', 'tablet'):
        raise ValueError('Unknown device surround')
    if kind == 'mac':
        return (
            '<span class="device-frame device-frame--mac" data-device-frame="mac">'
            '<img class="mac-hardware" src="assets/macbook-pro-photo.ad19aaf9d78e.jpg" alt="" aria-hidden="true" width="1320" height="1760" loading="lazy" decoding="async">'
            '<span class="device-frame__screen">' + content + '</span></span>'
        )
    return (
        f'<span class="device-frame device-frame--{kind}" data-device-frame="{kind}">'
        '<span class="device-frame__body">'
        '<span class="device-frame__camera" aria-hidden="true"></span>'
        '<span class="device-frame__screen">' + content + '</span></span>'
        + '</span>'
    )
