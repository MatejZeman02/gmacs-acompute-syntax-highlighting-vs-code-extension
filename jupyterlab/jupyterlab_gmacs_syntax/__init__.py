"""The prebuilt JupyterLab extension that highlights %%gmacs cells."""


def _jupyter_labextension_paths():
    return [{"src": "labextension", "dest": "jupyterlab-gmacs-syntax"}]
