import React from "react";
import Magic from "../utilities/Magic";
import Config from "../utilities/Config";
import { Redirect, Link } from "react-router-dom";
import FileUtilities from "../utilities/FileUtilities";

export default class Decrypt extends React.PureComponent {
    constructor(props) {
        super(props);
        this.toggleShowPassword = this.toggleShowPassword.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.decrypt = this.decrypt.bind(this);

        this.state = {
            showPassword: false,
            password: "",
            working: false,
            error: ""
        };
    }

    toggleShowPassword() {
        this.setState({ showPassword: !this.state.showPassword });
    }

    handleChange(event) {
        this.setState({
            [event.target.name]: event.target.value
        });
    }

    handleSubmit(event) {
        event.preventDefault();
        this.decrypt(this.props.inputFile);
    }

    decrypt(inputFile) {
        let data, salt, iv;
        return Magic.setStateWithPromise(this, { working: true })
            .then(() => {
                if (inputFile.isCloud) {
                    return FileUtilities.downloadFileFromGoogleDrive(inputFile.id, inputFile.access_token, true);
                } else {
                    return FileUtilities.readFileFromDevice(inputFile, true);
                }
            })
            .then(readInputFile => { data = readInputFile.data; salt = readInputFile.salt; iv = readInputFile.iv; })
            .then(() => window.crypto.subtle.importKey(
                Config.key.type,
                new TextEncoder(Config.encoding).encode(btoa(this.state.password)),
                { name: Config.key.name },
                Config.key.extractable,
                Config.key.operations))
            .then(pbkdf2Key => {
                return Magic.setStateWithPromise(this, { password: "" })
                    .then(() => window.crypto.subtle.deriveKey(
                        {
                            name: Config.key.name,
                            salt,
                            iterations: Config.key.iterations,
                            hash: { name: Config.key.hash }
                        },
                        pbkdf2Key,
                        {
                            name: Config.algorithm.name,
                            length: Config.algorithm.keySize
                        },
                        Config.key.extractable,
                        Config.algorithm.options.decrypt
                    ));
            })
            .then(key => window.crypto.subtle.decrypt(
                {
                    name: Config.algorithm.name,
                    iv,
                    tagLength: Config.algorithm.tagLength
                },
                key,
                data
            ))
            .then(decryptedFile => this.props.selectFile(null, {
                name: inputFile.name.substring(0, inputFile.name.lastIndexOf(".")) || `decrypted.${Config.fileExtension}`,
                data: decryptedFile
            }))
            .catch(error => Magic.setStateWithPromise(this, { error: error.toString() }))
            .then(() => Magic.setStateWithPromise(this, { working: false }));
    }

    render() {
        const { showPassword, working } = this.state;
        if (this.props.outputFile) {
            return <Redirect to="/save" />;
        } else if (this.props.inputFile) {
            if (working) {
                return <div>
                    <h4 className="mb-4">Decrypting...</h4>
                    <div className="text-secondary mb-4">Go take a nap or something.<br />Or talk to this dude while you wait.</div>
                    <span role="img" aria-label="poop" style={{ fontSize: "2.5rem" }}>&#128585;</span>
                </div>;
            } else {
                return <form onSubmit={this.handleSubmit}>
                    <h4 className="mb-4">Enter the password you chose.</h4>
                    {this.state.error ? <div className="mb-4 alert alert-danger" style={{ wordBreak: "break-word" }}>{this.state.error}</div> : null}
                    <div className="input-group">
                        <input required autoFocus autoComplete="off" maxLength={Config.maxPasswordLength} type={showPassword ? "text" : "password"} className="form-control" placeholder="Type password" value={this.state.password} onChange={this.handleChange} name="password" />
                        <div className="input-group-append">
                            <button tabIndex="-1" className={"btn " + (showPassword ? "btn-success" : "btn-danger")} type="button" onClick={this.toggleShowPassword}>{showPassword ? "Hide" : "Show"}</button>
                        </div>
                    </div>
                    <div className="mt-4">
                        <Link tabIndex="-1" to="/file_select">
                            <button className="btn btn-light mr-2" tabIndex="-1">Go back</button>
                        </Link>
                        <button disabled={this.state.password.length <= 0} type="submit" className="btn btn-primary">Decrypt</button>
                    </div>
                </form>
            }
        } else {
            return <Redirect to="/" />;
        }
    }
}