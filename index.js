import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { ActivityIndicator, Image, StyleSheet, View, Text } from 'react-native';

const styles = StyleSheet.create({
  centered: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const DefaultIndicator = ActivityIndicator;

export const createImageProgress = ImageComponent =>
  class ImageProgress extends Component {
    static propTypes = {
      children: PropTypes.node,
      errorContainerStyle: PropTypes.any,
      indicator: PropTypes.func,
      indicatorContainerStyle: PropTypes.any,
      indicatorProps: PropTypes.object,
      renderIndicator: PropTypes.func,
      renderError: PropTypes.func,
      source: PropTypes.any,
      style: PropTypes.any,
      threshold: PropTypes.number.isRequired,
      imageBorderRadius: PropTypes.any,
      resizable: PropTypes.bool,
      cacheLoading: PropTypes.bool
    };

    static defaultProps = {
      indicatorContainerStyle: styles.centered,
      errorContainerStyle: styles.centered,
      threshold: 50,
      resizable: false,
      cacheLoading: true
    };

    static prefetch = Image.prefetch;
    static getSize = Image.getSize;

    constructor(props) {
      super(props);

      this.state = {
        error: null,
        loading: false,
        progress: 0,
        thresholdReached: !props.threshold,
        errorRetryAttempts: 0
      };
    }

    componentDidMount() {
      if (this.props.threshold) {
        this.thresholdTimer = setTimeout(() => {
          this.setState({ thresholdReached: true });
          this.thresholdTimer = null;
        }, this.props.threshold);
      }
    }

    componentWillReceiveProps(props) {
      if (
        !this.props.source ||
        !props.source ||
        this.props.source.uri !== props.source.uri
      ) {
        this.setState({
          error: null,
          loading: false,
          progress: 0,
        });
      }
      this.setState({
        error: props.cacheError,
      })

    }

    componentWillUnmount() {
      if (this.thresholdTimer) {
        clearTimeout(this.thresholdTimer);
      }
    }

    setNativeProps(nativeProps) {
      if (this.ref) {
        this.ref.setNativeProps(nativeProps);
      }
    }

    ref = null;
    handleRef = ref => {
      this.ref = ref;
    };

    bubbleEvent(propertyName, event) {
      if (typeof this.props[propertyName] === 'function') {
        this.props[propertyName](event);
      }
    }

    handleLoadStart = () => {
      if (!this.state.loading && this.state.progress !== 1) {
        this.setState({
          error: null,
          loading: true,
          progress: 0,
        });
      }
      this.bubbleEvent('onLoadStart');
    };

    handleProgress = event => {
      const progress = event.nativeEvent.loaded / event.nativeEvent.total;
      // RN is a bit buggy with these events, sometimes a loaded event and then a few
      // 100% progress – sometimes in an infinite loop. So we just assume 100% progress
      // actually means the image is no longer loading
      if (progress !== this.state.progress && this.state.progress !== 1) {
        this.setState({
          loading: progress < 1,
          progress,
        });
      }
      this.bubbleEvent('onProgress', event);
    };

    handleError = event => {
      this.setState({
        loading: false,
        error: event.nativeEvent,
        errorRetryAttempts: this.state.errorRetryAttempts + 1
      });
      this.bubbleEvent('onError', { event, errorRetryAttempts: this.state.errorRetryAttempts });
    };

    handleLoad = event => {
      if (this.state.progress !== 1) {
        this.setState({
          error: null,
          loading: false,
          progress: 1,
        });
      }
      this.bubbleEvent('onLoad', event);
    };


    render() {
      const {
        children,
        errorContainerStyle,
        indicator,
        indicatorContainerStyle,
        indicatorProps,
        renderError,
        renderIndicator,
        source,
        style,
        threshold,
        imageBorderRadius,
        cacheError,
        cacheLoading,
        ...props
      } = this.props;

      if (typeof source !== 'object') {
        // This is not a networked asset so fallback to regular image
        // the cache set the source to {} for network request
          return (
            <ImageComponent source={source} style={style} {...props}>
              {children}
            </ImageComponent>
          );
      }
      const { progress, thresholdReached, loading, error } = this.state;
      let indicatorElement;

      if (error) { // todo && !(error.statusCode == 401 && error.attempts == 1)
        if (renderError) {
          // error occurred - show "no image found" image
          indicatorElement = (
            <View style={errorContainerStyle}>{renderError(error)}</View>
          );
        }
      } else if ((cacheLoading || loading || progress < 1) && thresholdReached) {
        // "loading in progress"
        if (renderIndicator) {
          indicatorElement = renderIndicator(progress, !loading || !progress);
        } else {
          // "spinner"
          const IndicatorComponent = typeof indicator === 'function'
            ? indicator
            : DefaultIndicator;
          indicatorElement = (
            <IndicatorComponent
              progress={progress}
              indeterminate={!loading || !progress}
              {...indicatorProps}
            />
          );
        }
        indicatorElement = (
          <View style={indicatorContainerStyle}>{indicatorElement}</View>
        );
      }
      return (
        <View style={[style, (this.state.error && this.props.resizable) && { height: 200 }]} ref={this.handleRef}>
          <ImageComponent
            {...props}
            key={source && source.uri}
            onLoadStart={this.handleLoadStart}
            onProgress={this.handleProgress}
            onError={this.handleError}
            onLoad={this.handleLoad}
            source={source}
            style={[StyleSheet.absoluteFill, imageBorderRadius]}
          />
          {indicatorElement}
          {children}
        </View>
      );
    }
  };

export default createImageProgress(Image);
