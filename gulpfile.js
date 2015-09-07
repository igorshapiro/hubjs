var gulp = require('gulp'),
    uglify = require('gulp-uglify'),
    jshint = require('gulp-jshint'),
    concat = require('gulp-concat'),
    sass = require('gulp-sass'),
    minifyCSS = require('gulp-minify-css'),
    rename = require('gulp-rename'),
    include = require('gulp-include')

gulp.task('js', function() {
  return gulp.src('ui/js/*.js')
      // .pipe(jshint())
      // .pipe(jshint.reporter('default'))
      .pipe(include())
        .on('error', console.log)
      .pipe(uglify())
      .pipe(concat('app.js'))
      .pipe(gulp.dest('public/'))
})

gulp.task('css', function() {
  return gulp.src('ui/css/app.scss')
      .pipe(sass())
        .on('error', console.log)
      .pipe(minifyCSS())
      .pipe(rename("app.css"))
      .pipe(gulp.dest('public/'))
})

gulp.task('default', function() {})
gulp.task('watch', function() {
  gulp.watch('ui/js/*.js', ['js'])
  gulp.watch('ui/css/**/*', ['css'])
})
